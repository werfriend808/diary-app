import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fromKey, mediumDate } from './dates';
import { Letter } from './types';

// Show letter notifications even if the app happens to be open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CHANNEL = 'letters';
/** Letters unlock in the morning rather than at midnight. */
const UNLOCK_HOUR = 9;

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Letters to future you',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Schedules "your letter is ready" for the morning it unlocks. Returns the notification id, if any. */
export async function scheduleLetterNotification(letter: Letter): Promise<string | undefined> {
  try {
    const when = fromKey(letter.opensOn);
    when.setHours(UNLOCK_HOUR, 0, 0, 0);
    if (when.getTime() <= Date.now()) return undefined;
    if (!(await ensurePermission())) return undefined;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'A letter from your past self ✉️',
        body: `You wrote it on ${mediumDate(letter.writtenOn)}. It’s ready to open.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
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
  if (!id || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or gone.
  }
}
