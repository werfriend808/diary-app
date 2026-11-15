import AsyncStorage from '@react-native-async-storage/async-storage';
import { fs } from '../../test/mocks/expo-file-system';
import { makeEntry, makeLetter } from '../../test/factories';
import {
  deletePhoto,
  isPhotoName,
  loadEntries,
  loadLetters,
  newId,
  persistPhoto,
  photoFile,
  photoUrl,
  saveEntries,
  saveLetters,
  savePhotoFromBase64,
} from '../storage';

const ENTRIES = 'data/entries.json';
const TMP = 'data/entries.json.tmp';
const json = (v: unknown) => JSON.stringify(v);

describe('storage: first launch', () => {
  it('returns an empty diary when nothing was ever saved, without writing anything', async () => {
    await expect(loadEntries()).resolves.toEqual([]);
    await expect(loadLetters()).resolves.toEqual([]);
    expect(fs.has(ENTRIES)).toBe(false);
  });
});

describe('storage: atomic save (temp file, then rename)', () => {
  it('round-trips entries and letters and leaves no temp file behind', async () => {
    const entries = [makeEntry(), makeEntry({ mood: 'great', place: 'Seattle' })];
    const letters = [makeLetter()];
    await saveEntries(entries);
    await saveLetters(letters);
    await expect(loadEntries()).resolves.toEqual(entries);
    await expect(loadLetters()).resolves.toEqual(letters);
    expect(fs.has(TMP)).toBe(false);
    expect(fs.has('data/letters.json')).toBe(true);
  });

  it('writes the complete list to the temp file before touching the real file', async () => {
    const old = [makeEntry()];
    await saveEntries(old);
    const next = [...old, makeEntry()];

    let seenAtMove: { tmp?: string; real?: string } = {};
    fs.hooks.beforeMove = () => {
      seenAtMove = { tmp: fs.read(TMP), real: fs.read(ENTRIES) };
    };
    await saveEntries(next);

    expect(seenAtMove.tmp).toBe(json(next)); // temp file already complete
    expect(seenAtMove.real).toBe(json(old)); // real file still the previous version
    expect(fs.read(ENTRIES)).toBe(json(next));
  });

  it('keeps the previous diary intact when the app dies while writing the temp file', async () => {
    const old = [makeEntry()];
    await saveEntries(old);
    fs.hooks.beforeWrite = (uri) => {
      if (uri.endsWith('.tmp')) throw new Error('killed');
    };

    await expect(saveEntries([...old, makeEntry()])).rejects.toThrow('killed');
    expect(fs.read(ENTRIES)).toBe(json(old));
    fs.hooks = {};
    await expect(loadEntries()).resolves.toEqual(old); // the half-written temp file is ignored
  });

  it('keeps the previous diary when the app dies between writing the temp file and renaming it', async () => {
    const old = [makeEntry()];
    await saveEntries(old);
    fs.hooks.beforeMove = () => {
      throw new Error('killed');
    };

    await expect(saveEntries([makeEntry()])).rejects.toThrow('killed');
    fs.hooks = {};
    await expect(loadEntries()).resolves.toEqual(old);

    // The next save works normally and replaces the stale temp file.
    const next = [makeEntry()];
    await saveEntries(next);
    await expect(loadEntries()).resolves.toEqual(next);
    expect(fs.has(TMP)).toBe(false);
  });
});

describe('storage: recovering an interrupted save', () => {
  it('uses a complete temp file when the real file is missing (rename was cut short)', async () => {
    const newest = [makeEntry(), makeEntry()];
    fs.put(TMP, json(newest));
    await expect(loadEntries()).resolves.toEqual(newest);
  });

  it('ignores a truncated temp file when the real file is missing', async () => {
    fs.put(TMP, json([makeEntry()]).slice(0, 10));
    await expect(loadEntries()).resolves.toEqual([]);
  });

  it('prefers the real file over a leftover temp file (that save never committed)', async () => {
    const committed = [makeEntry()];
    fs.put(ENTRIES, json(committed));
    fs.put(TMP, json([makeEntry(), makeEntry()]));
    await expect(loadEntries()).resolves.toEqual(committed);
  });
});

describe('storage: fail-safe loading (never start empty over a damaged diary)', () => {
  it.each([
    ['invalid JSON', '{"id": "e1", "tit'],
    ['JSON that is not a list', '{"entries": []}'],
    ['an empty file', ''],
  ])('throws on %s instead of returning [] — and leaves the file untouched', async (_label, content) => {
    fs.put(ENTRIES, content);
    await expect(loadEntries()).rejects.toThrow();
    expect(fs.read(ENTRIES)).toBe(content);
  });

  it('does not fall back to a valid temp file when the real file is damaged', async () => {
    fs.put(ENTRIES, 'garbage');
    fs.put(TMP, json([makeEntry()]));
    await expect(loadEntries()).rejects.toThrow();
  });

  it('throws when the old AsyncStorage copy is damaged', async () => {
    await AsyncStorage.setItem('diary.entries.v1', 'not json');
    await expect(loadEntries()).rejects.toThrow();
  });
});

describe('storage: migration from AsyncStorage (v1)', () => {
  it('copies the old data into the file and leaves AsyncStorage untouched', async () => {
    const legacy = [makeEntry({ photoName: 'a.jpg' })];
    await AsyncStorage.setItem('diary.entries.v1', json(legacy));

    await expect(loadEntries()).resolves.toEqual(legacy);
    expect(JSON.parse(fs.read(ENTRIES)!)).toEqual(legacy);
    expect(await AsyncStorage.getItem('diary.entries.v1')).toBe(json(legacy));
  });

  it('still opens the diary, and removes a bad copy, when copying into the file fails', async () => {
    const legacy = [makeEntry()];
    await AsyncStorage.setItem('diary.entries.v1', json(legacy));
    fs.hooks.beforeMove = () => {
      throw new Error('disk full');
    };

    await expect(loadEntries()).resolves.toEqual(legacy);
    expect(fs.has(ENTRIES)).toBe(false); // next launch starts over from AsyncStorage
    expect(await AsyncStorage.getItem('diary.entries.v1')).toBe(json(legacy));
  });
});

describe('storage: upgrading records written by older versions', () => {
  it('turns a full photo path into a file name and keeps an untouched copy of the old list once', async () => {
    const old = { ...makeEntry(), photoUri: 'file:///var/mobile/app/Documents/photos/1727312345678-ab3de.jpg' };
    fs.put(ENTRIES, json([old]));

    const [entry] = await loadEntries();
    expect(entry.photoName).toBe('1727312345678-ab3de.jpg');
    expect(entry).not.toHaveProperty('photoUri');
    expect(fs.read('data/entries.before-v2.json')).toBe(json([old]));

    // A later load (with different data) never overwrites the safety copy.
    fs.put(ENTRIES, json([{ ...old, title: 'changed' }]));
    await loadEntries();
    expect(fs.read('data/entries.before-v2.json')).toBe(json([old]));
  });

  it('decodes percent-encoded photo paths', async () => {
    fs.put(ENTRIES, json([{ ...makeEntry(), photoUri: 'file:///x/photos/my%2Dphoto.png' }]));
    expect((await loadEntries())[0].photoName).toBe('my-photo.png');
  });

  it('keeps a record exactly as it is when the old photo path makes no sense', async () => {
    const odd = { ...makeEntry(), photoUri: 'content://weird/../../etc/passwd' };
    fs.put(ENTRIES, json([odd]));
    await expect(loadEntries()).resolves.toEqual([odd]);
  });

  it('drops a redundant old path when the record already has a photo name', async () => {
    const both = { ...makeEntry({ photoName: 'b.jpg' }), photoUri: 'file:///x/photos/a.jpg' };
    fs.put(ENTRIES, json([both]));
    const [entry] = await loadEntries();
    expect(entry.photoName).toBe('b.jpg');
    expect(entry).not.toHaveProperty('photoUri');
  });

  it('gives letters without updatedAt their creation time', async () => {
    const { updatedAt: _drop, ...old } = makeLetter({ createdAt: 123 });
    fs.put('data/letters.json', json([old]));
    expect((await loadLetters())[0].updatedAt).toBe(123);
    expect(fs.has('data/letters.before-v2.json')).toBe(true);
  });

  it('writes no safety copy when nothing needed upgrading', async () => {
    fs.put(ENTRIES, json([makeEntry()]));
    await loadEntries();
    expect(fs.has('data/entries.before-v2.json')).toBe(false);
  });
});

describe('photos', () => {
  it.each(['1727312345678-ab3de.jpg', 'IMG_0001.HEIC', 'a.png'])('accepts the plain file name %s', (name) => {
    expect(isPhotoName(name)).toBe(true);
  });

  it.each(['../secret.jpg', 'photos/a.jpg', 'a', '.jpg', 'a.toolongext', '', 42, undefined])(
    'rejects %p, so a name can never point outside the photos folder',
    (name) => {
      expect(isPhotoName(name)).toBe(false);
      expect(photoFile(name as string)).toBeNull();
    },
  );

  it('copies a picked photo into the photos folder and can delete it again', async () => {
    fs.files.set('file:///cache/picker/tmp123.jpg', 'IMAGE');
    const name = await persistPhoto('file:///cache/picker/tmp123.jpg');
    expect(isPhotoName(name)).toBe(true);
    expect(fs.read(`photos/${name}`)).toBe('IMAGE');
    expect(photoUrl(name)).toBe(`file:///document/photos/${name}`);

    deletePhoto(name);
    expect(fs.has(`photos/${name}`)).toBe(false);
    expect(() => deletePhoto(name)).not.toThrow(); // already gone
    expect(() => deletePhoto(undefined)).not.toThrow();
  });

  it('restores a backup photo under its old name when that name is free', () => {
    expect(savePhotoFromBase64('QUJD', '.jpg', 'kept-name.jpg')).toBe('kept-name.jpg');
    expect(fs.read('photos/kept-name.jpg')).toBe('QUJD');
  });

  it('never overwrites an existing photo with a restored one', () => {
    fs.put('photos/taken.jpg', 'ORIGINAL');
    const name = savePhotoFromBase64('TkVX', '.jpg', 'taken.jpg');
    expect(name).not.toBe('taken.jpg');
    expect(fs.read('photos/taken.jpg')).toBe('ORIGINAL');
  });

  it('ignores an unsafe name or extension coming from a backup file', () => {
    const name = savePhotoFromBase64('QUJD', '/../../x', '../escape.jpg');
    expect(isPhotoName(name)).toBe(true);
    expect(name.endsWith('.jpg')).toBe(true);
    expect(fs.list('photos')).toEqual([name]);
  });
});

describe('ids', () => {
  it('creates unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, newId));
    expect(ids.size).toBe(1000);
  });
});
