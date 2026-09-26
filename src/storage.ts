import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Entry, Letter } from './types';

const KEY = 'diary.entries.v1';

/**
 * Only "nothing saved yet" becomes an empty list. A failed read or unreadable data throws instead:
 * falling back to [] would let the next save overwrite the whole diary.
 */
async function loadList<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`Stored data under ${key} is not a list.`);
  return parsed as T[];
}

export const loadEntries = () => loadList<Entry>(KEY);

export async function saveEntries(entries: Entry[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

const LETTERS_KEY = 'diary.letters.v1';

export const loadLetters = () => loadList<Letter>(LETTERS_KEY);

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

/** Writes a photo restored from a backup into the app's photo folder; returns its new URI. */
export function savePhotoFromBase64(base64: string, extension: string): string {
  // The extension comes from the backup file, so only allow a plain one (no "/" or "..").
  const clean = /^\.?[a-z0-9]{1,5}$/i.test(extension) ? extension : '.jpg';
  const ext = clean.startsWith('.') ? clean : `.${clean}`;
  const dest = new File(photoDir(), `${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`);
  dest.write(base64, { encoding: 'base64' });
  return dest.uri;
}
