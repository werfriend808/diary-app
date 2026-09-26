import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { isDateKey, todayKey } from './dates';
import { savePhotoFromBase64 } from './storage';
import { MOODS } from './theme';
import { Entry, Letter, MoodKey } from './types';

/**
 * Backup file format (one JSON file):
 * {
 *   app: 'my-diary', version: 1, exportedAt,
 *   entries: [ ...Entry fields, photo?: { ext, base64 } ],   // photoUri is not portable, so photos are embedded
 *   letters: [ ...Letter fields ]
 * }
 */
const APP_ID = 'my-diary';
const VERSION = 1;

type BackupEntry = Omit<Entry, 'photoUri'> & { photo?: { ext: string; base64: string } };

interface BackupFile {
  app: string;
  version: number;
  exportedAt: number;
  entries: BackupEntry[];
  letters: Letter[];
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
    letters: letters.map(({ notificationId, ...l }) => l),
  };
  file.write(`${JSON.stringify(head).slice(0, -1)},"entries":[`);
  let first = true;
  for (const { photoUri, ...rest } of entries) {
    let photo: BackupEntry['photo'];
    if (photoUri) {
      try {
        const f = new File(photoUri);
        if (f.exists) photo = { ext: f.extension || '.jpg', base64: await f.base64() };
      } catch {
        // Photo missing on disk — keep the entry, skip the photo.
      }
    }
    const packed: BackupEntry = photo ? { ...rest, photo } : rest;
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
 * Lets the user pick a backup file and merges it into the current data.
 * Entries/letters that already exist (same id) are kept as they are, so importing
 * the same backup twice never creates duplicates. Returns null if the user cancels.
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

  const entryIds = new Set(current.entries.map((e) => e.id));
  const letterIds = new Set(current.letters.map((l) => l.id));
  let skipped = 0;

  const newEntries: Entry[] = [];
  for (const raw of data.entries as unknown[]) {
    const entry = readEntry(raw);
    if (!entry) {
      skipped++;
      continue;
    }
    if (entryIds.has(entry.id)) continue;
    entryIds.add(entry.id);
    const photo = (raw as { photo?: { ext?: unknown; base64?: unknown } }).photo;
    let photoUri: string | undefined;
    if (typeof photo?.base64 === 'string' && photo.base64) {
      try {
        photoUri = savePhotoFromBase64(photo.base64, typeof photo.ext === 'string' ? photo.ext : '.jpg');
      } catch {
        // Keep the text even if the photo can't be written.
      }
    }
    newEntries.push(photoUri ? { ...entry, photoUri } : entry);
  }

  const newLetters: Letter[] = [];
  for (const raw of data.letters as unknown[]) {
    const letter = readLetter(raw);
    if (!letter) {
      skipped++;
      continue;
    }
    if (letterIds.has(letter.id)) continue;
    letterIds.add(letter.id);
    newLetters.push(letter);
  }

  return {
    entries: [...current.entries, ...newEntries],
    letters: [...current.letters, ...newLetters],
    addedEntries: newEntries.length,
    addedLetters: newLetters.length,
    skipped,
  };
}

// A backup file can be edited or damaged, and whatever gets imported is saved and rendered on every launch.
// So each item is rebuilt field by field: anything malformed is skipped, and unknown fields
// (like a photoUri pointing somewhere else on the phone) are never carried over.

const isText = (v: unknown): v is string => typeof v === 'string';
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const MOOD_KEYS: readonly unknown[] = MOODS.map((m) => m.key);

function readEntry(raw: unknown): Omit<Entry, 'photoUri'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isText(r.id) || !r.id || !isDateKey(r.date) || !isText(r.title) || !isText(r.body) || !isTime(r.createdAt)) {
    return null;
  }
  const entry: Omit<Entry, 'photoUri'> = {
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
  const letter: Letter = { id: r.id, body: r.body, writtenOn: r.writtenOn, opensOn: r.opensOn, createdAt: r.createdAt };
  if (isTime(r.openedAt)) letter.openedAt = r.openedAt;
  return letter;
}
