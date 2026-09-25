import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { fromKey, mediumDate } from './dates';
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
/** Letters unlock in the morning rather than at midnight. */
const UNLOCK_HOUR = 9;

async function ensurePermission(N: NotificationsModule): Promise<boolean> {
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL, {
      name: 'Letters to future you',
      importance: N.AndroidImportance.DEFAULT,
    });
  }
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

/** Schedules "your letter is ready" for the morning it unlocks. Returns the notification id, if any. */
export async function scheduleLetterNotification(letter: Letter): Promise<string | undefined> {
  try {
    const N = notifications();
    if (!N) return undefined;
    const when = fromKey(letter.opensOn);
    when.setHours(UNLOCK_HOUR, 0, 0, 0);
    if (when.getTime() <= Date.now()) return undefined;
    if (!(await ensurePermission(N))) return undefined;
    return await N.scheduleNotificationAsync({
      content: {
        title: 'A letter from your past self ✉️',
        body: `You wrote it on ${mediumDate(letter.writtenOn)}. It’s ready to open.`,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: CHANNEL,
      },
    });
  } catch {
    // Notifications are a nice-to-have; the letter still unlocks in the app.
    return undefined;
  }
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
