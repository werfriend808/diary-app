import { makeEntry, makeLetter } from '../../test/factories';
import { deletedEntry, deletedLetter, isLive } from '../records';

const NOW = 1_800_000_000_000;

describe('tombstones (soft delete)', () => {
  it('empties a deleted entry down to its id, date and timestamps', () => {
    const e = makeEntry({ mood: 'sad', photoName: 'a.jpg', place: 'Busan', createdAt: 100, updatedAt: 200 });
    expect(deletedEntry(e, NOW)).toEqual({
      id: e.id,
      date: e.date,
      title: '',
      body: '',
      createdAt: 100,
      updatedAt: NOW,
      deletedAt: NOW,
    });
  });

  it('bumps updatedAt to the deletion time, so a future sync sees the delete as the newest change', () => {
    const e = makeEntry({ updatedAt: 1 });
    const t = deletedEntry(e, NOW);
    expect(t.updatedAt).toBe(NOW);
    expect(t.updatedAt).toBeGreaterThan(e.updatedAt);
  });

  it('empties a deleted letter and drops its notification id', () => {
    const l = makeLetter({ opensAt: 5_000, openedAt: 6_000, notificationId: 'n1' });
    expect(deletedLetter(l, NOW)).toEqual({
      id: l.id,
      body: '',
      writtenOn: l.writtenOn,
      opensOn: l.opensOn,
      opensAt: 5_000,
      createdAt: l.createdAt,
      updatedAt: NOW,
      deletedAt: NOW,
    });
  });

  it('leaves opensAt out of a tombstone for letters that never had one', () => {
    expect(deletedLetter(makeLetter(), NOW)).not.toHaveProperty('opensAt');
  });

  it('tells live records from tombstones', () => {
    const e = makeEntry();
    expect(isLive(e)).toBe(true);
    expect(isLive(deletedEntry(e, NOW))).toBe(false);
    expect(isLive({ deletedAt: 0 })).toBe(false); // 0 is still a deletion time
  });
});
