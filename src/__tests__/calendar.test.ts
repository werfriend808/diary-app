import { makeEntry } from '../../test/factories';
import { dayMood, entriesByDay, monthGrid } from '../calendar';

const days = (grid: (string | null)[]) => grid.filter((c): c is string => c !== null);

describe('mood calendar grid', () => {
  it.each([
    // month, blank cells before the 1st, days, total cells
    [new Date(2026, 1, 1), 0, 28, 28], // Feb 2026 starts on Sunday: exactly 4 rows
    [new Date(2024, 1, 1), 4, 29, 35], // leap February starting Thursday
    [new Date(2026, 7, 1), 6, 31, 42], // Aug 2026 starts Saturday: 6 rows
    [new Date(2026, 2, 1), 0, 31, 35], // March with the daylight-saving change
  ])('lays out %s in whole weeks starting on Sunday', (month, blanks, count, total) => {
    const grid = monthGrid(month);
    expect(grid.length).toBe(total);
    expect(grid.length % 7).toBe(0);
    expect(grid.slice(0, blanks).every((c) => c === null)).toBe(true);
    expect(grid[blanks]).not.toBeNull();
    expect(days(grid)).toHaveLength(count);
  });

  it('lists every day of the month once, in order, even across daylight-saving changes', () => {
    for (const month of [new Date(2026, 2, 1), new Date(2026, 10, 1)]) {
      const list = days(monthGrid(month));
      expect(new Set(list).size).toBe(list.length);
      expect(list).toEqual([...list].sort());
      expect(list[0].endsWith('-01')).toBe(true);
    }
  });

  it('works from any day inside the month', () => {
    expect(monthGrid(new Date(2026, 1, 17))).toEqual(monthGrid(new Date(2026, 1, 1)));
  });
});

describe('entries per day and the mood dot', () => {
  it('groups entries by day, keeping their order', () => {
    const a = makeEntry({ date: '2026-03-14' });
    const b = makeEntry({ date: '2026-03-13' });
    const c = makeEntry({ date: '2026-03-14' });
    const map = entriesByDay([a, b, c]);
    expect(map.get('2026-03-14')).toEqual([a, c]);
    expect(map.get('2026-03-13')).toEqual([b]);
    expect(map.get('2026-03-12')).toBeUndefined();
  });

  it('shows the mood of the first (newest) entry that has one', () => {
    const noMood = makeEntry();
    const sad = makeEntry({ mood: 'sad' });
    const great = makeEntry({ mood: 'great' });
    expect(dayMood([noMood, sad, great])).toBe('sad');
    expect(dayMood([noMood])).toBeUndefined();
    expect(dayMood(undefined)).toBeUndefined();
  });
});
