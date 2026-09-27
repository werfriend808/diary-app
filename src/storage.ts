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
 *
 * Records written by older versions are upgraded as they're read (v2: photo file names instead of full
 * paths, updatedAt on letters). The upgraded shape is what gets saved from then on.
 */

const USE_FILES = Platform.OS !== 'web';

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

/**
 * Loads a list and brings older records up to the current shape (see upgradeEntry/upgradeLetter).
 * The first time an upgrade changes anything, the list exactly as it was stored is copied to
 * "<name>.before-v2.json" next to it and never touched again — so the conversion can always be undone.
 */
async function loadList<T>(where: Store): Promise<T[]> {
  const stored = await loadStored<unknown>(where);
  const upgraded = stored.map(where.upgrade);
  if (USE_FILES && upgraded.some((item, i) => item !== stored[i])) keepCopyBeforeUpgrade(where.file, stored);
  return upgraded as T[];
}

function keepCopyBeforeUpgrade(name: string, stored: unknown[]) {
  try {
    const copy = new File(dataDir(), name.replace(/\.json$/, '.before-v2.json'));
    if (copy.exists) return;
    copy.create();
    copy.write(JSON.stringify(stored));
  } catch {
    // Only extra insurance: the upgraded list in memory is complete either way.
  }
}

async function loadStored<T>(where: Store): Promise<T[]> {
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

async function saveList(where: Store, list: unknown[]) {
  if (USE_FILES) writeFile(where.file, list);
  else await AsyncStorage.setItem(where.legacyKey, JSON.stringify(list));
}

/*
 * Upgrades run on every load, on each stored record as-is. They only add or convert fields, never drop a
 * record, and return the same object when there's nothing to do. Anything they don't recognise is left alone.
 */

/** Entries saved before v2 hold the photo's full file:// path in photoUri; v2 keeps only its file name. */
function upgradeEntry(item: unknown): unknown {
  if (!item || typeof item !== 'object' || !('photoUri' in item)) return item;
  const { photoUri, ...rest } = item as Record<string, unknown>;
  if (isPhotoName(rest.photoName)) return rest; // already converted; the old path is redundant
  const name = photoNameFromUri(photoUri);
  // Can't make sense of the old path: keep the record exactly as it is rather than lose the reference.
  return name ? { ...rest, photoName: name } : item;
}

/** Letters saved before v2 have no updatedAt; their creation time is the best stand-in. */
function upgradeLetter(item: unknown): unknown {
  if (!item || typeof item !== 'object') return item;
  const l = item as Record<string, unknown>;
  if (typeof l.updatedAt === 'number' && Number.isFinite(l.updatedAt)) return item;
  return { ...l, updatedAt: typeof l.createdAt === 'number' ? l.createdAt : 0 };
}

interface Store {
  file: string;
  legacyKey: string;
  upgrade: (item: unknown) => unknown;
}

const ENTRIES: Store = { file: 'entries.json', legacyKey: 'diary.entries.v1', upgrade: upgradeEntry };
const LETTERS: Store = { file: 'letters.json', legacyKey: 'diary.letters.v1', upgrade: upgradeLetter };

export const loadEntries = () => loadList<Entry>(ENTRIES);
export const saveEntries = (entries: Entry[]) => saveList(ENTRIES, entries);

export const loadLetters = () => loadList<Letter>(LETTERS);
export const saveLetters = (letters: Letter[]) => saveList(LETTERS, letters);

// ---- photos ----
// Photos live in <documents>/photos. Entries store only the file name (Entry.photoName).

const PHOTO_DIR = 'photos';

/** A bare file name like "1727312345678-ab3de.jpg" — no folders, so it can never point outside the photos folder. */
export const isPhotoName = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,80}\.[a-z0-9]{1,5}$/i.test(v);

/** The file name at the end of an old full photo path (every photo the app saved is in the photos folder). */
function photoNameFromUri(uri: unknown): string | null {
  if (typeof uri !== 'string') return null;
  let name = uri.slice(uri.lastIndexOf('/') + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    // Not percent-encoded; use as is.
  }
  return isPhotoName(name) ? name : null;
}

function photoDir() {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** The photo's file, or null for a missing/invalid name (or on web, which has no file system). */
export function photoFile(name?: string): File | null {
  if (!USE_FILES || !isPhotoName(name)) return null;
  return new File(Paths.document, PHOTO_DIR, name);
}

const urlCache = new Map<string, string>();

/** Turns a stored photo file name into a file:// URI an <Image> can show. */
export function photoUrl(name?: string): string | undefined {
  if (!name) return undefined;
  let url = urlCache.get(name);
  if (url === undefined) {
    url = photoFile(name)?.uri;
    if (url) urlCache.set(name, url);
  }
  return url;
}

function newPhotoName(ext: string) {
  const clean = ext.startsWith('.') ? ext : `.${ext}`;
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}${clean}`;
}

/**
 * The image picker returns a temporary cache file. Copy it into the app's photos folder so it's
 * still there next time the app opens. Returns the new photo's file name.
 */
export async function persistPhoto(tempUri: string): Promise<string> {
  const src = new File(tempUri);
  const ext = /^\.?[a-z0-9]{1,5}$/i.test(src.extension) ? src.extension : '.jpg';
  const dest = new File(photoDir(), newPhotoName(ext));
  await src.copy(dest);
  return dest.name;
}

export function deletePhoto(name?: string) {
  try {
    const f = photoFile(name);
    if (f?.exists) f.delete();
  } catch {
    // Already gone — nothing to do.
  }
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * Writes a photo restored from a backup into the photos folder and returns its file name. Keeps the
 * name it had in the backup when that's a valid name not already taken here; otherwise makes a new one.
 */
export function savePhotoFromBase64(base64: string, extension: string, preferredName?: string): string {
  // The extension comes from the backup file, so only allow a plain one (no "/" or "..").
  const ext = /^\.?[a-z0-9]{1,5}$/i.test(extension) ? extension : '.jpg';
  const dir = photoDir();
  const name =
    isPhotoName(preferredName) && !new File(dir, preferredName).exists ? preferredName : newPhotoName(ext);
  const dest = new File(dir, name);
  dest.write(base64, { encoding: 'base64' });
  return dest.name;
}
