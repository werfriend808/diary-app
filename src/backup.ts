import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { isDateKey, todayKey } from './dates';
import { isLive } from './records';
import { photoFile, savePhotoFromBase64 } from './storage';
import { MOODS } from './theme';
import { Entry, Letter, MoodKey } from './types';

/**
 * Backup file format (one JSON file):
 * {
 *   app: 'my-diary', version: 1, exportedAt,
 *   entries: [ ...Entry fields, photo?: { ext, base64 } ],   // the photo itself is embedded next to photoName
 *   letters: [ ...Letter fields except notificationId ]
 * }
 * Still version 1: fields added since (photoName, letters' updatedAt) are optional, older app versions
 * ignore them, and files written before them still import. Older files have no photoName (their photos
 * were only embedded) and letters without updatedAt, which then falls back to createdAt.
 *
 * Deleted items (tombstones) are left out on purpose: they hold no content, so they add nothing to a
 * restore, and older app versions don't know deletedAt and would show them as empty "Untitled" entries.
 */
const APP_ID = 'my-diary';
const VERSION = 1;

type BackupEntry = Omit<Entry, 'deletedAt'> & { photo?: { ext: string; base64: string } };
type BackupLetter = Omit<Letter, 'notificationId' | 'deletedAt'>;

interface BackupFile {
  app: string;
  version: number;
  exportedAt: number;
  entries: BackupEntry[];
  letters: BackupLetter[];
}

const FILE_PREFIX = 'my-diary-backup-';

/** Builds the backup file and opens the share sheet so the user can save it (Files, Drive, email…). */
export async function exportBackup(entries: Entry[], letters: Letter[]) {
  const file = new File(Paths.cache, `${FILE_PREFIX}${todayKey()}.json`);
  file.create({ overwrite: true });

  // Written a piece at a time (one entry and its photo per write) so a diary with many photos never
  // has to fit in memory as one giant string. The result is the same BackupFile JSON as before.
  const head: Omit<BackupFile, 'entries'> = {
    app: APP_ID,
    version: VERSION,
    exportedAt: Date.now(),
    // Notification ids only make sense on this phone.
    letters: letters.filter(isLive).map(({ notificationId, deletedAt, ...l }) => l),
  };
  file.write(`${JSON.stringify(head).slice(0, -1)},"entries":[`);
  let first = true;
  for (const { photoName, deletedAt, ...rest } of entries.filter(isLive)) {
    let photo: BackupEntry['photo'];
    try {
      const f = photoFile(photoName);
      if (f?.exists) photo = { ext: f.extension || '.jpg', base64: await f.base64() };
    } catch {
      // Photo missing on disk — keep the entry, skip the photo.
    }
    // photoName only travels with the photo it names.
    const packed: BackupEntry = photo ? { ...rest, photoName, photo } : rest;
    file.write(`${first ? '' : ','}${JSON.stringify(packed)}`, { append: true });
    first = false;
  }
  file.write(']}', { append: true });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Save your diary backup',
  });
}

/**
 * Deletes backup files earlier exports left in the cache. They're kept until the next launch rather
 * than removed right after sharing, because some Android apps read the file after the share sheet closes.
 */
export function removeOldBackupFiles() {
  if (Platform.OS === 'web') return;
  try {
    for (const item of new Directory(Paths.cache).list()) {
      if (item instanceof File && item.name.startsWith(FILE_PREFIX)) item.delete();
    }
  } catch {
    // Only a cleanup; try again next launch.
  }
}

export interface ImportResult {
  entries: Entry[];
  letters: Letter[];
  addedEntries: number;
  addedLetters: number;
  /** Items in the file that were damaged or incomplete and were left out. */
  skipped: number;
}

/**
 * Lets the user pick a backup file and merges it into the current data (which includes tombstones).
 * Entries/letters that already exist (same id) are kept as they are, so importing the same backup
 * twice never creates duplicates. One exception: if the item was deleted here, the backup's copy
 * replaces the tombstone — restoring is an explicit request to get it back — and its updatedAt is set
 * to now, so that for a future sync the restore counts as newer than the deletion.
 * Returns null if the user cancels.
 */
export async function importBackup(current: {
  entries: Entry[];
  letters: Letter[];
}): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  let data: BackupFile;
  try {
    data = JSON.parse(await new File(picked.assets[0].uri).text());
  } catch {
    throw new Error('That file isn’t a diary backup.');
  }
  if (data?.app !== APP_ID || !Array.isArray(data.entries) || !Array.isArray(data.letters)) {
    throw new Error('That file isn’t a diary backup.');
  }
  if (data.version > VERSION) {
    throw new Error('This backup was made by a newer version of the app. Please update the app first.');
  }

  const now = Date.now();
  let skipped = 0;

  // Current items by id; imported ones are added as they go, so a repeated id in the file counts once.
  const entryById = new Map(current.entries.map((e) => [e.id, e]));
  const restoredEntries = new Map<string, Entry>(); // tombstones replaced by the backup's copy
  const newEntries: Entry[] = [];
  for (const raw of data.entries as unknown[]) {
    if (isTombstone(raw)) continue; // we never export these; nothing to restore
    const entry = readEntry(raw);
    if (!entry) {
      skipped++;
      continue;
    }
    const existing = entryById.get(entry.id);
    if (existing && isLive(existing)) continue;
    const photo = (raw as { photo?: { ext?: unknown; base64?: unknown } }).photo;
    const backupName = (raw as { photoName?: unknown }).photoName;
    let photoName: string | undefined;
    if (typeof photo?.base64 === 'string' && photo.base64) {
      try {
        photoName = savePhotoFromBase64(
          photo.base64,
          typeof photo.ext === 'string' ? photo.ext : '.jpg',
          typeof backupName === 'string' ? backupName : undefined,
        );
      } catch {
        // Keep the text even if the photo can't be written.
      }
    }
    const imported: Entry = { ...entry, ...(photoName ? { photoName } : {}), ...(existing ? { updatedAt: now } : {}) };
    entryById.set(imported.id, imported);
    if (existing) restoredEntries.set(imported.id, imported);
    else newEntries.push(imported);
  }

  const letterById = new Map(current.letters.map((l) => [l.id, l]));
  const restoredLetters = new Map<string, Letter>();
  const newLetters: Letter[] = [];
  for (const raw of data.letters as unknown[]) {
    if (isTombstone(raw)) continue;
    const letter = readLetter(raw);
    if (!letter) {
      skipped++;
      continue;
    }
    const existing = letterById.get(letter.id);
    if (existing && isLive(existing)) continue;
    const imported: Letter = existing ? { ...letter, updatedAt: now } : letter;
    letterById.set(imported.id, imported);
    if (existing) restoredLetters.set(imported.id, imported);
    else newLetters.push(imported);
  }

  return {
    entries: [...current.entries.map((e) => restoredEntries.get(e.id) ?? e), ...newEntries],
    letters: [...current.letters.map((l) => restoredLetters.get(l.id) ?? l), ...newLetters],
    addedEntries: newEntries.length + restoredEntries.size,
    addedLetters: newLetters.length + restoredLetters.size,
    skipped,
  };
}

// A backup file can be edited or damaged, and whatever gets imported is saved and rendered on every launch.
// So each item is rebuilt field by field: anything malformed is skipped, and unknown fields
// (like an old photoUri pointing somewhere on another phone) are never carried over.
// photoName is only set from a photo actually written here (see importBackup).

const isText = (v: unknown): v is string => typeof v === 'string';
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const MOOD_KEYS: readonly unknown[] = MOODS.map((m) => m.key);

const isTombstone = (raw: unknown) =>
  !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).deletedAt !== undefined;

function readEntry(raw: unknown): Omit<Entry, 'photoName'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isText(r.id) || !r.id || !isDateKey(r.date) || !isText(r.title) || !isText(r.body) || !isTime(r.createdAt)) {
    return null;
  }
  const entry: Omit<Entry, 'photoName'> = {
    id: r.id,
    date: r.date,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt,
    updatedAt: isTime(r.updatedAt) ? r.updatedAt : r.createdAt,
  };
  if (MOOD_KEYS.includes(r.mood)) entry.mood = r.mood as MoodKey;
  return entry;
}

function readLetter(raw: unknown): Letter | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    !isText(r.id) ||
    !r.id ||
    !isText(r.body) ||
    !isDateKey(r.writtenOn) ||
    !isDateKey(r.opensOn) ||
    !isTime(r.createdAt)
  ) {
    return null;
  }
  const letter: Letter = {
    id: r.id,
    body: r.body,
    writtenOn: r.writtenOn,
    opensOn: r.opensOn,
    createdAt: r.createdAt,
    // Backups made before letters had updatedAt fall back to createdAt.
    updatedAt: isTime(r.updatedAt) ? r.updatedAt : r.createdAt,
  };
  if (isTime(r.openedAt)) letter.openedAt = r.openedAt;
  return letter;
}
