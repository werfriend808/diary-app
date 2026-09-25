import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { todayKey } from './dates';
import { savePhotoFromBase64 } from './storage';
import { Entry, Letter } from './types';

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

/** Builds the backup file and opens the share sheet so the user can save it (Files, Drive, email…). */
export async function exportBackup(entries: Entry[], letters: Letter[]) {
  const packed: BackupEntry[] = [];
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
    packed.push(photo ? { ...rest, photo } : rest);
  }

  const data: BackupFile = {
    app: APP_ID,
    version: VERSION,
    exportedAt: Date.now(),
    // Notification ids only make sense on this phone.
    entries: packed,
    letters: letters.map(({ notificationId, ...l }) => l),
  };

  const file = new File(Paths.cache, `my-diary-backup-${todayKey()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Save your diary backup',
  });
}

export interface ImportResult {
  entries: Entry[];
  letters: Letter[];
  addedEntries: number;
  addedLetters: number;
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

  const newEntries: Entry[] = [];
  for (const { photo, ...rest } of data.entries) {
    if (!rest.id || entryIds.has(rest.id)) continue;
    let photoUri: string | undefined;
    if (photo?.base64) {
      try {
        photoUri = savePhotoFromBase64(photo.base64, photo.ext || '.jpg');
      } catch {
        // Keep the text even if the photo can't be written.
      }
    }
    newEntries.push(photoUri ? { ...rest, photoUri } : rest);
  }

  const newLetters = data.letters.filter((l) => l.id && !letterIds.has(l.id));

  return {
    entries: [...current.entries, ...newEntries],
    letters: [...current.letters, ...newLetters],
    addedEntries: newEntries.length,
    addedLetters: newLetters.length,
  };
}
