import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { fs } from '../../test/mocks/expo-file-system';
import { makeEntry, makeLetter } from '../../test/factories';
import { exportBackup, importBackup, removeOldBackupFiles } from '../backup';
import { todayKey } from '../dates';
import { t } from '../i18n';
import { deletedEntry, deletedLetter } from '../records';
import { Entry, Letter } from '../types';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));

const picker = DocumentPicker.getDocumentAsync as jest.Mock;
const PICKED = 'file:///cache/DocumentPicker/backup.json';

/** Makes the next "choose a file" return a file with this content. */
function pickFile(content: unknown) {
  fs.files.set(PICKED, typeof content === 'string' ? content : JSON.stringify(content));
  picker.mockResolvedValueOnce({ canceled: false, assets: [{ uri: PICKED }] });
}

const backupOf = (entries: unknown[] = [], letters: unknown[] = [], extra: object = {}) => ({
  app: 'my-diary',
  version: 1,
  exportedAt: 1,
  entries,
  letters,
  ...extra,
});

const importInto = (entries: Entry[] = [], letters: Letter[] = []) => importBackup({ entries, letters });

/** Runs exportBackup and returns the parsed file it handed to the share sheet. */
async function exportToJson(entries: Entry[], letters: Letter[]) {
  await exportBackup(entries, letters);
  const raw = fs.files.get(`file:///cache/my-diary-backup-${todayKey()}.json`)!;
  return { raw, data: JSON.parse(raw) };
}

afterEach(() => {
  jest.restoreAllMocks();
  picker.mockReset();
});

describe('exportBackup', () => {
  it('writes one JSON file in the version 1 format and opens the share sheet', async () => {
    const { data } = await exportToJson([makeEntry()], [makeLetter()]);
    expect(data).toMatchObject({ app: 'my-diary', version: 1 });
    expect(typeof data.exportedAt).toBe('number');
    expect(data.entries).toHaveLength(1);
    expect(data.letters).toHaveLength(1);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      `file:///cache/my-diary-backup-${todayKey()}.json`,
      expect.objectContaining({ mimeType: 'application/json' }),
    );
  });

  it('leaves out deleted items and phone-only notification ids', async () => {
    const live = makeEntry();
    const gone = deletedEntry(makeEntry(), 5);
    const letter = makeLetter({ notificationId: 'n1' });
    const goneLetter = deletedLetter(makeLetter(), 5);
    const { data } = await exportToJson([live, gone], [letter, goneLetter]);

    expect(data.entries.map((e: Entry) => e.id)).toEqual([live.id]);
    expect(data.letters.map((l: Letter) => l.id)).toEqual([letter.id]);
    expect(data.letters[0]).not.toHaveProperty('notificationId');
    expect(JSON.stringify(data)).not.toContain('deletedAt');
  });

  it('embeds each photo next to its name, and drops the name when the photo file is missing', async () => {
    fs.put('photos/here.jpg', 'QUJD');
    const withPhoto = makeEntry({ photoName: 'here.jpg' });
    const lostPhoto = makeEntry({ photoName: 'gone.jpg' });
    const { data } = await exportToJson([withPhoto, lostPhoto], []);

    expect(data.entries[0]).toMatchObject({ photoName: 'here.jpg', photo: { ext: '.jpg', base64: 'QUJD' } });
    expect(data.entries[1]).not.toHaveProperty('photo');
    expect(data.entries[1]).not.toHaveProperty('photoName');
  });

  it('fails with a clear message when the phone cannot share files', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await expect(exportBackup([], [])).rejects.toThrow(t('backup.noSharing'));
  });

  it('cleans up backup files left in the cache by earlier exports, and nothing else', () => {
    fs.files.set('file:///cache/my-diary-backup-2026-01-01.json', '{}');
    fs.files.set('file:///cache/other.json', '{}');
    removeOldBackupFiles();
    expect(fs.files.has('file:///cache/my-diary-backup-2026-01-01.json')).toBe(false);
    expect(fs.files.has('file:///cache/other.json')).toBe(true);
  });
});

describe('export -> import round trip', () => {
  it('restores everything onto an empty phone, photos included', async () => {
    fs.put('photos/p1.jpg', 'UEhPVE8=');
    const entries = [makeEntry({ photoName: 'p1.jpg', mood: 'good', place: 'Seoul' }), makeEntry()];
    const letters = [makeLetter({ opensAt: new Date(2027, 2, 14, 21, 30).getTime(), opensOn: '2027-03-14' })];
    const { raw } = await exportToJson(entries, letters);

    fs.reset(); // new phone
    pickFile(raw);
    const result = await importInto();

    expect(result).toMatchObject({ addedEntries: 2, addedLetters: 1, skipped: 0 });
    expect(result!.entries).toEqual(entries);
    expect(result!.letters).toEqual(letters);
    expect(fs.read('photos/p1.jpg')).toBe('UEhPVE8=');
  });
});

describe('importBackup: rejecting files that are not a backup', () => {
  it('returns null when the user cancels', async () => {
    picker.mockResolvedValueOnce({ canceled: true, assets: null });
    await expect(importInto()).resolves.toBeNull();
  });

  it.each([
    ['text that is not JSON', 'hello'],
    ['JSON from another app', { app: 'other-app', version: 1, entries: [], letters: [] }],
    ['a file with no entries list', { app: 'my-diary', version: 1, letters: [] }],
    ['a file whose letters are not a list', { app: 'my-diary', version: 1, entries: [], letters: {} }],
    ['JSON null', 'null'],
  ])('rejects %s', async (_label, content) => {
    pickFile(content);
    await expect(importInto()).rejects.toThrow(t('backup.notABackup'));
  });

  it.each([
    ['no version', { version: undefined }],
    ['a version that is not a number', { version: 'one' }],
    ['a fractional version', { version: 1.5 }],
    ['version 0', { version: 0 }],
  ])('rejects a file with %s', async (_label, extra) => {
    pickFile(backupOf([makeEntry()], [], extra));
    await expect(importInto()).rejects.toThrow(t('backup.notABackup'));
  });

  it('refuses a backup from a newer app version instead of half-reading it', async () => {
    pickFile(backupOf([makeEntry()], [], { version: 2 }));
    await expect(importInto()).rejects.toThrow(t('backup.tooNew'));
  });
});

describe('importBackup: additive-only merge', () => {
  it('adds new items and never removes or changes anything already on the phone', async () => {
    const mine = makeEntry({ title: 'mine' });
    const alsoMine = makeEntry();
    const myLetter = makeLetter();
    const incoming = makeEntry();
    pickFile(backupOf([{ ...mine, title: 'edited elsewhere' }, incoming], []));

    const result = (await importInto([mine, alsoMine], [myLetter]))!;
    expect(result.entries).toEqual([mine, alsoMine, incoming]);
    expect(result.letters).toEqual([myLetter]);
    expect(result.addedEntries).toBe(1);
  });

  it('is idempotent: importing the same backup twice adds nothing the second time', async () => {
    const file = backupOf([makeEntry(), makeEntry()], [makeLetter()]);
    pickFile(file);
    const first = (await importInto())!;
    pickFile(file);
    const second = (await importInto(first.entries, first.letters))!;

    expect(second.entries).toEqual(first.entries);
    expect(second.letters).toEqual(first.letters);
    expect(second.addedEntries + second.addedLetters).toBe(0);
  });

  it('counts an id repeated inside the file only once', async () => {
    const e = makeEntry();
    pickFile(backupOf([e, { ...e, title: 'dupe' }], []));
    const result = (await importInto())!;
    expect(result.entries).toEqual([e]);
    expect(result.addedEntries).toBe(1);
  });

  it('brings back an item deleted on this phone, in place, as the newest change', async () => {
    const NOW = 1_900_000_000_000;
    const before = makeEntry();
    const other = makeEntry();
    const tomb = deletedEntry(before, NOW - 1000);
    const letter = makeLetter();
    const tombLetter = deletedLetter(letter, NOW - 1000);
    pickFile(backupOf([before], [letter]));
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    const result = (await importInto([tomb, other], [tombLetter]))!;
    expect(result.entries).toEqual([{ ...before, updatedAt: NOW }, other]);
    expect(result.letters).toEqual([{ ...letter, updatedAt: NOW }]);
    expect(result).toMatchObject({ addedEntries: 1, addedLetters: 1 });
  });

  it('skips tombstones found in a file without calling them damaged', async () => {
    pickFile(backupOf([deletedEntry(makeEntry(), 5)], [deletedLetter(makeLetter(), 5)]));
    await expect(importInto()).resolves.toMatchObject({ addedEntries: 0, addedLetters: 0, skipped: 0 });
  });
});

describe('importBackup: validating each item', () => {
  const good = () => makeEntry();

  it.each([
    ['no id', { ...good(), id: undefined }],
    ['an empty id', { ...good(), id: '' }],
    ['a date that does not exist', { ...good(), date: '2025-02-29' }],
    ['a date in another format', { ...good(), date: '14/03/2026' }],
    ['a title that is not text', { ...good(), title: 42 }],
    ['no body', { ...good(), body: undefined }],
    ['a creation time that is not a number', { ...good(), createdAt: '2026-03-14' }],
    ['not an object', 'just a string'],
    ['null', null],
  ])('leaves out an entry with %s and counts it as skipped', async (_label, bad) => {
    const ok = good();
    pickFile(backupOf([bad, ok], []));
    const result = (await importInto())!;
    expect(result.entries).toEqual([ok]);
    expect(result.skipped).toBe(1);
  });

  it('leaves out letters with missing or invalid days', async () => {
    const ok = makeLetter();
    pickFile(backupOf([], [{ ...makeLetter(), opensOn: '2027-13-01' }, { ...makeLetter(), writtenOn: undefined }, ok]));
    const result = (await importInto())!;
    expect(result.letters).toEqual([ok]);
    expect(result.skipped).toBe(2);
  });

  it('rebuilds entries field by field: unknown fields and invalid moods are dropped, places are cleaned', async () => {
    const raw = {
      ...good(),
      mood: 'ecstatic',
      place: `   ${'가'.repeat(100)}  `,
      photoUri: 'file:///another/phone/photos/x.jpg',
      photoName: 'not-embedded.jpg',
      __proto__hack: true,
    };
    pickFile(backupOf([raw], []));
    const [entry] = (await importInto())!.entries;

    expect(entry).not.toHaveProperty('mood');
    expect(entry).not.toHaveProperty('photoUri');
    expect(entry).not.toHaveProperty('__proto__hack');
    // photoName only comes from a photo actually written here.
    expect(entry).not.toHaveProperty('photoName');
    expect(entry.place).toBe('가'.repeat(80));
  });

  it('keeps valid moods', async () => {
    pickFile(backupOf([{ ...good(), mood: 'low' }], []));
    expect((await importInto())!.entries[0].mood).toBe('low');
  });
});

describe('importBackup: backward compatibility with older backup files', () => {
  it('reads an early v1 file (no photoName, place or updatedAt; photo only embedded)', async () => {
    const early = {
      id: 'old1',
      date: '2025-12-24',
      title: 'Christmas Eve',
      body: '...',
      mood: 'great',
      createdAt: 1_735_000_000_000,
      photo: { ext: '.png', base64: 'T0xE' },
    };
    pickFile(backupOf([early], []));
    const [entry] = (await importInto())!.entries;

    expect(entry.updatedAt).toBe(early.createdAt);
    expect(entry.photoName).toMatch(/\.png$/);
    expect(fs.read(`photos/${entry.photoName}`)).toBe('T0xE');
  });

  it('reads letters from before updatedAt and opensAt existed', async () => {
    const old = { id: 'l-old', body: 'hi', writtenOn: '2025-01-01', opensOn: '2026-01-01', createdAt: 77 };
    pickFile(backupOf([], [old]));
    const [letter] = (await importInto())!.letters;
    expect(letter).toEqual({ ...old, updatedAt: 77 });
    expect(letter).not.toHaveProperty('opensAt');
  });

  it('keeps opensOn in step with opensAt when both are present', async () => {
    const opensAt = new Date(2027, 5, 1, 0, 30).getTime(); // just after midnight, local time
    pickFile(backupOf([], [{ ...makeLetter(), opensAt, opensOn: '2027-05-31' }]));
    expect((await importInto())!.letters[0].opensOn).toBe('2027-06-01');
  });

  it('ignores top-level fields it does not know (written by a newer v1 app)', async () => {
    const e = makeEntry();
    pickFile(backupOf([e], [], { device: 'Pixel 9', settings: { theme: 'dark' } }));
    expect((await importInto())!.entries).toEqual([e]);
  });

  it('keeps an entry’s text even if its photo cannot be written', async () => {
    const e = { ...makeEntry(), photoName: 'x.jpg', photo: { ext: '.jpg', base64: 'QUJD' } };
    pickFile(backupOf([e], []));
    fs.hooks.beforeWrite = (uri) => {
      if (uri.includes('/photos/')) throw new Error('disk full');
    };
    const [entry] = (await importInto())!.entries;
    expect(entry.title).toBe(e.title);
    expect(entry).not.toHaveProperty('photoName');
  });
});
