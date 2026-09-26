import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { Entry, Letter } from './types';

/*
 * Entries and letters are stored as JSON files in the app's document folder. They used to live in
 * AsyncStorage, which on Android caps its whole database at 6 MB — years of daily writing can reach that.
 * The first launch after the update copies the AsyncStorage data into the files and leaves the old copy
 * where it is. On web (no file system) AsyncStorage is still used.
 *
 * Throughout: only "nothing saved yet" becomes an empty list. A failed read or unreadable data throws,
 * because falling back to [] would let the next save overwrite the whole diary.
 */

const USE_FILES = Platform.OS !== 'web';

const ENTRIES = { file: 'entries.json', legacyKey: 'diary.entries.v1' };
const LETTERS = { file: 'letters.json', legacyKey: 'diary.letters.v1' };

function parseList<T>(raw: string, source: string): T[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`Stored data in ${source} is not a list.`);
  return parsed as T[];
}

function dataDir() {
  const dir = new Directory(Paths.document, 'data');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Returns null when the file has never been written. */
function readFile<T>(name: string): T[] | null {
  const dir = dataDir();
  const file = new File(dir, name);
  if (file.exists) return parseList<T>(file.textSync(), name);
  // No file, but a complete temp file: the last save stopped before moving it into place, so it
  // holds the newest diary. If the save stopped while writing it, it's unreadable — ignore it.
  const tmp = new File(dir, `${name}.tmp`);
  if (tmp.exists) {
    try {
      return parseList<T>(tmp.textSync(), tmp.name);
    } catch {
      return null;
    }
  }
  return null;
}

/** Writes a temp file, then moves it over the real one, so a crash never leaves half a list behind. */
function writeFile(name: string, list: unknown[]) {
  const dir = dataDir();
  const tmp = new File(dir, `${name}.tmp`);
  tmp.create({ overwrite: true });
  tmp.write(JSON.stringify(list));
  tmp.moveSync(new File(dir, name), { overwrite: true });
}

async function readLegacy<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw === null ? [] : parseList<T>(raw, key);
}

async function loadList<T>(where: { file: string; legacyKey: string }): Promise<T[]> {
  if (!USE_FILES) return readLegacy<T>(where.legacyKey);

  const saved = readFile<T>(where.file);
  if (saved) return saved;

  // First launch after the update: copy the AsyncStorage data into the file, and check it reads back.
  const legacy = await readLegacy<T>(where.legacyKey);
  if (legacy.length > 0) {
    try {
      writeFile(where.file, legacy);
      if (readFile<T>(where.file)?.length !== legacy.length) throw new Error('Copied data did not read back.');
    } catch {
      // Remove the bad copy so the next launch starts over from AsyncStorage, which is untouched.
      // The diary still opens now; the next save tries the file again and reports if it fails.
      try {
        const bad = new File(dataDir(), where.file);
        if (bad.exists) bad.delete();
      } catch {
        // Nothing more to do; AsyncStorage still has everything.
      }
    }
  }
  return legacy;
}

async function saveList(where: { file: string; legacyKey: string }, list: unknown[]) {
  if (USE_FILES) writeFile(where.file, list);
  else await AsyncStorage.setItem(where.legacyKey, JSON.stringify(list));
}

export const loadEntries = () => loadList<Entry>(ENTRIES);
export const saveEntries = (entries: Entry[]) => saveList(ENTRIES, entries);

export const loadLetters = () => loadList<Letter>(LETTERS);
export const saveLetters = (letters: Letter[]) => saveList(LETTERS, letters);

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
