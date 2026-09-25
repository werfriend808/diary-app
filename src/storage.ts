import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Entry, Letter } from './types';

const KEY = 'diary.entries.v1';

export async function loadEntries(): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

export async function saveEntries(entries: Entry[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

const LETTERS_KEY = 'diary.letters.v1';

export async function loadLetters(): Promise<Letter[]> {
  try {
    const raw = await AsyncStorage.getItem(LETTERS_KEY);
    return raw ? (JSON.parse(raw) as Letter[]) : [];
  } catch {
    return [];
  }
}

export async function saveLetters(letters: Letter[]) {
  await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(letters));
}

function photoDir() {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * The image picker returns a temporary cache file. Copy it into the app's
 * document folder so the photo is still there next time the app opens.
 */
export async function persistPhoto(tempUri: string): Promise<string> {
  const src = new File(tempUri);
  const ext = src.extension || '.jpg';
  const dest = new File(photoDir(), `${Date.now()}${ext.startsWith('.') ? ext : '.' + ext}`);
  await src.copy(dest);
  return dest.uri;
}

export function deletePhoto(uri?: string) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone — nothing to do.
  }
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
