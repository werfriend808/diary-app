import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguagePref } from './i18n';
import { ThemePref } from './theme';

export interface Settings {
  theme: ThemePref;
  /** Ask for Face ID / fingerprint / passcode when the app opens. */
  lock: boolean;
  /** 'system' follows the phone (Korean if the phone is in Korean, otherwise English). */
  language: LanguagePref;
}

const KEY = 'diary.settings.v1';
export const DEFAULT_SETTINGS: Settings = { theme: 'system', lock: false, language: 'system' };

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    // Settings couldn't be read, so we don't know whether the lock was on. Assume it was: an extra
    // unlock prompt is better than opening a locked diary. (Phones without a screen lock skip it.)
    return { ...DEFAULT_SETTINGS, lock: true };
  }
}

export async function saveSettings(s: Settings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
