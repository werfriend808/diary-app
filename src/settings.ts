import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemePref } from './theme';

export interface Settings {
  theme: ThemePref;
  /** Ask for Face ID / fingerprint / passcode when the app opens. */
  lock: boolean;
}

const KEY = 'diary.settings.v1';
export const DEFAULT_SETTINGS: Settings = { theme: 'system', lock: false };

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
