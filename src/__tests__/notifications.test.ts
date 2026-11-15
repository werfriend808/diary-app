import { makeLetter } from '../../test/factories';
import { unlockTime } from '../letters';
import { deletedLetter } from '../records';
import {
  cancelNotification,
  notificationPermission,
  onLetterNotificationTap,
  syncLetterNotifications,
} from '../notifications';

const mockN = {
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getAllScheduledNotificationsAsync: jest.fn(async (): Promise<unknown[]> => []),
  cancelScheduledNotificationAsync: jest.fn(async (_id: string) => {}),
  scheduleNotificationAsync: jest.fn(async (_req: { trigger: { date: Date }; content: { data: object } }) => 'id'),
  getLastNotificationResponse: jest.fn((): unknown => null),
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  addNotificationResponseReceivedListener: jest.fn((_cb: (r: unknown) => void) => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  DEFAULT_ACTION_IDENTIFIER: 'default',
};
// Named mock* so Jest allows the factory to use it; notifications.ts requires the module lazily.
jest.mock('expo-notifications', () => mockN);
const N = mockN;


const NOW = new Date(2026, 2, 14, 12, 0).getTime();
const future = (days: number) => NOW + days * 86_400_000;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  let n = 0;
  N.scheduleNotificationAsync.mockImplementation(async () => `notif-${++n}`);
});
afterEach(() => jest.restoreAllMocks());

const scheduledLetterIds = () =>
  N.scheduleNotificationAsync.mock.calls.map(([req]) => (req.content.data as { letterId: string }).letterId);

describe('syncLetterNotifications', () => {
  it('schedules one notification per letter still to open, at the moment it opens', async () => {
    const soon = makeLetter({ opensAt: future(1) });
    const later = makeLetter({ opensAt: future(30) });
    const result = await syncLetterNotifications([later, soon], { askPermission: false });

    expect(scheduledLetterIds()).toEqual([soon.id, later.id]); // soonest first
    expect(N.scheduleNotificationAsync.mock.calls[0][0].trigger.date.getTime()).toBe(unlockTime(soon));
    expect(result.permission).toBe('granted');
    expect([...result.ids.entries()]).toEqual([
      [soon.id, 'notif-1'],
      [later.id, 'notif-2'],
    ]);
  });

  it('skips deleted, already opened and already unlocked letters', async () => {
    const ok = makeLetter({ opensAt: future(2) });
    const letters = [
      ok,
      deletedLetter(makeLetter({ opensAt: future(3) }), NOW),
      makeLetter({ opensAt: future(4), openedAt: NOW }),
      makeLetter({ opensAt: NOW - 1 }),
      makeLetter({ opensAt: NOW }), // opens right now: nothing left to announce
    ];
    await syncLetterNotifications(letters, { askPermission: false });
    expect(scheduledLetterIds()).toEqual([ok.id]);
  });

  it('schedules only the 50 soonest letters (iOS keeps at most 64 per app)', async () => {
    const letters = Array.from({ length: 70 }, (_, i) => makeLetter({ opensAt: future(70 - i) }));
    const result = await syncLetterNotifications(letters, { askPermission: false });
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(50);
    const times = N.scheduleNotificationAsync.mock.calls.map(([r]) => r.trigger.date.getTime());
    expect(Math.max(...times)).toBe(future(50));
    expect(result.ids.size).toBe(50);
  });

  it('replaces this app’s earlier letter notifications but leaves any others alone', async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: 'old-letter', content: { data: { kind: 'letter' } } },
      { identifier: 'from-old-version', content: { data: {} } },
      { identifier: 'something-else', content: { data: { kind: 'reminder' } } },
    ]);
    await syncLetterNotifications([], { askPermission: false });
    expect(N.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id)).toEqual(['old-letter', 'from-old-version']);
  });

  it('schedules nothing without permission, and never asks unless told to', async () => {
    N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    const result = await syncLetterNotifications([makeLetter({ opensAt: future(1) })], { askPermission: false });
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ permission: 'undetermined', ids: new Map() });
    N.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  });

  it('asks for permission only when there is a letter to notify about', async () => {
    N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    await syncLetterNotifications([], { askPermission: true });
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();

    await syncLetterNotifications([makeLetter({ opensAt: future(1) })], { askPermission: true });
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    N.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  });

  it('does not ask again once the user said no for good', async () => {
    N.getPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const result = await syncLetterNotifications([makeLetter({ opensAt: future(1) })], { askPermission: true });
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(result.permission).toBe('denied');
    N.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  });

  it('keeps going when one letter cannot be scheduled', async () => {
    const [a, b] = [makeLetter({ opensAt: future(1) }), makeLetter({ opensAt: future(2) })];
    N.scheduleNotificationAsync.mockRejectedValueOnce(new Error('nope'));
    const result = await syncLetterNotifications([a, b], { askPermission: false });
    expect([...result.ids.keys()]).toEqual([b.id]);
  });

  it('never throws, even if the notification system fails entirely', async () => {
    N.getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('broken'));
    await expect(syncLetterNotifications([makeLetter({ opensAt: future(1) })], { askPermission: false })).resolves.toEqual({
      permission: 'granted',
      ids: new Map(),
    });
  });

  it('runs overlapping syncs one after another, so a letter is never scheduled twice at once', async () => {
    const order: string[] = [];
    N.getAllScheduledNotificationsAsync.mockImplementation(async () => {
      order.push('list');
      await new Promise((r) => setTimeout(r, 5));
      return [];
    });
    N.scheduleNotificationAsync.mockImplementation(async () => {
      order.push('schedule');
      return 'x';
    });
    const letters = [makeLetter({ opensAt: future(1) })];
    await Promise.all([
      syncLetterNotifications(letters, { askPermission: false }),
      syncLetterNotifications(letters, { askPermission: false }),
    ]);
    expect(order).toEqual(['list', 'schedule', 'list', 'schedule']);
    N.getAllScheduledNotificationsAsync.mockImplementation(async () => []);
  });
});

describe('opening a letter from its notification', () => {
  const response = (data: object, action = 'default') => ({
    actionIdentifier: action,
    notification: { request: { content: { data } } },
  });

  it('opens the letter whose notification launched the app, once', () => {
    N.getLastNotificationResponse.mockReturnValueOnce(response({ kind: 'letter', letterId: 'l1' }));
    const open = jest.fn();
    onLetterNotificationTap(open);
    expect(open).toHaveBeenCalledWith('l1');
    expect(N.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('opens letters tapped while the app is running, and stops listening when asked', () => {
    const open = jest.fn();
    const stop = onLetterNotificationTap(open);
    const listener = N.addNotificationResponseReceivedListener.mock.calls[0][0];
    listener(response({ kind: 'letter', letterId: 'l2' }));
    listener(response({ kind: 'reminder', letterId: 'x' }));
    listener(response({ kind: 'letter', letterId: 'l3' }, 'dismiss'));
    listener(response({ kind: 'letter', letterId: 42 }));
    expect(open.mock.calls).toEqual([['l2']]);

    stop();
    expect(N.addNotificationResponseReceivedListener.mock.results[0].value.remove).toHaveBeenCalled();
  });
});

describe('small helpers', () => {
  it('cancelNotification ignores missing ids and notifications that are already gone', async () => {
    await cancelNotification(undefined);
    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    N.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('gone'));
    await expect(cancelNotification('n1')).resolves.toBeUndefined();
  });

  it('notificationPermission reports the status without asking, and survives errors', async () => {
    await expect(notificationPermission()).resolves.toBe('granted');
    N.getPermissionsAsync.mockRejectedValueOnce(new Error('x'));
    await expect(notificationPermission()).resolves.toBe('undetermined');
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
