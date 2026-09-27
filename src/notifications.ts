import { isRunningInExpoGo } from 'expo';
import type { NotificationResponse } from 'expo-notifications';
import { Platform } from 'react-native';
import { mediumDate } from './dates';
import { unlockTime } from './letters';
import { isLive } from './records';
import { Letter } from './types';

type NotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications crashes on load inside Expo Go on Android (Expo removed it there in SDK 53).
 * So it's loaded lazily, and skipped entirely in that one case. In the real store build and on
 * iPhone it works normally; in Expo Go on Android letters simply don't send a notification.
 */
const supported = Platform.OS !== 'web' && !(Platform.OS === 'android' && isRunningInExpoGo());

let cached: NotificationsModule | null = null;
function notifications(): NotificationsModule | null {
  if (!supported) return null;
  if (!cached) {
    // A lazy require on purpose (see above) — a top-level import would crash Expo Go on Android.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
    // Show letter notifications even if the app happens to be open.
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  return cached;
}

const CHANNEL = 'letters';
/** Marks this app's letter notifications (in content.data) so they can be told apart and opened on tap. */
const LETTER_KIND = 'letter';
/**
 * iOS keeps at most 64 scheduled notifications per app and silently drops the rest. Only the soonest
 * letters get one; the others are scheduled on a later launch as earlier ones open.
 */
const MAX_SCHEDULED = 50;

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

async function checkPermission(N: NotificationsModule, ask: boolean): Promise<NotificationPermission> {
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL, {
      name: 'Letters to future you',
      importance: N.AndroidImportance.DEFAULT,
    });
  }
  const current = await N.getPermissionsAsync();
  if (current.status === 'granted' || !ask || !current.canAskAgain) return current.status;
  return (await N.requestPermissionsAsync()).status;
}

export interface SyncResult {
  permission: NotificationPermission;
  /** Letter id -> id of the notification now scheduled for it. Letters not in here have none. */
  ids: Map<string, string>;
}

// Syncs run one after another, so two can never interleave and schedule the same letter twice.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Makes the scheduled notifications match `letters`: removes every letter notification this app has
 * scheduled, then schedules one for each of the (up to 50) soonest letters still to open, at the moment
 * it opens. Only asks for permission when `askPermission` is set and there's a letter to notify about —
 * never at app start. Without permission nothing is scheduled; letters open in the app regardless.
 */
export function syncLetterNotifications(letters: Letter[], opts: { askPermission: boolean }): Promise<SyncResult> {
  const run = queue.then(
    () => sync(letters, opts),
    () => sync(letters, opts),
  );
  queue = run.catch(() => undefined);
  return run;
}

async function sync(letters: Letter[], { askPermission }: { askPermission: boolean }): Promise<SyncResult> {
  const ids = new Map<string, string>();
  const N = notifications();
  if (!N) return { permission: 'unsupported', ids };
  let permission: NotificationPermission = 'undetermined';
  try {
    const now = Date.now();
    const upcoming = letters
      .filter((l) => isLive(l) && !l.openedAt && unlockTime(l) > now)
      .sort((a, b) => unlockTime(a) - unlockTime(b));
    permission = await checkPermission(N, askPermission && upcoming.length > 0);

    // Older versions scheduled only letter notifications and set no data.kind, so those count too.
    for (const req of await N.getAllScheduledNotificationsAsync()) {
      const kind = req.content.data?.kind;
      if (kind === undefined || kind === LETTER_KIND) await N.cancelScheduledNotificationAsync(req.identifier);
    }
    if (permission !== 'granted') return { permission, ids };

    for (const letter of upcoming.slice(0, MAX_SCHEDULED)) {
      try {
        ids.set(letter.id, await N.scheduleNotificationAsync(letterNotification(N, letter)));
      } catch {
        // Skip this one; the letter still opens in the app, and the next sync tries again.
      }
    }
  } catch {
    // Notifications are a nice-to-have; letters still open in the app. Report what got scheduled.
  }
  return { permission, ids };
}

function letterNotification(N: NotificationsModule, letter: Letter) {
  return {
    content: {
      title: 'A letter from your past self ✉️',
      body: `You wrote it on ${mediumDate(letter.writtenOn)}. It’s open now.`,
      data: { kind: LETTER_KIND, letterId: letter.id },
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DATE,
      date: new Date(unlockTime(letter)),
      channelId: CHANNEL,
    },
  } as const;
}

/** Current permission, without asking. */
export async function notificationPermission(): Promise<NotificationPermission> {
  const N = notifications();
  if (!N) return 'unsupported';
  try {
    return (await N.getPermissionsAsync()).status;
  } catch {
    return 'undetermined';
  }
}

/**
 * Calls `open(letterId)` when the user taps a letter notification — including the tap that launched
 * the app. Returns a function that stops listening.
 */
export function onLetterNotificationTap(open: (letterId: string) => void): () => void {
  const N = notifications();
  if (!N) return () => {};
  const handle = (response: NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
    const data = response.notification.request.content.data;
    if (data?.kind === LETTER_KIND && typeof data.letterId === 'string') open(data.letterId);
  };
  try {
    handle(N.getLastNotificationResponse());
    // Handled; don't open it again the next time this runs.
    N.clearLastNotificationResponseAsync().catch(() => undefined);
  } catch {
    // Nothing to open.
  }
  const sub = N.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

export async function cancelNotification(id?: string) {
  const N = notifications();
  if (!id || !N) return;
  try {
    await N.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or gone.
  }
}
