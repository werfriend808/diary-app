import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** How long the app can sit in the background before it locks again (covers photo picking, sharing…). */
export const RELOCK_AFTER_MS = 60_000;

/** True if the phone has a passcode, PIN, fingerprint or face unlock set up. */
export async function canLock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Shows Face ID / fingerprint, falling back to the phone's passcode. */
export async function unlock(prompt = 'Unlock your diary'): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      fallbackLabel: 'Use passcode',
    });
    return result.success;
  } catch {
    return false;
  }
}
