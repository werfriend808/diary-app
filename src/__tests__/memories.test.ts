import { makeEntry } from '../../test/factories';
import { applyLanguage } from '../i18n';
import { memoriesFor, memoryLabel } from '../memories';

beforeAll(() => applyLanguage('en'));

const on = (date: string) => makeEntry({ date });
const agesFor = (dates: string[], today: string) =>
  memoriesFor(dates.map(on), today).map((m) => [m.entry.date, m.ago]);

describe('On this day', () => {
  it('finds the same date in earlier years, oldest first', () => {
    expect(agesFor(['2025-03-14', '2023-03-14', '2024-03-14'], '2026-03-14')).toEqual([
      ['2023-03-14', { years: 3 }],
      ['2024-03-14', { years: 2 }],
      ['2025-03-14', { years: 1 }],
    ]);
  });

  it('finds the same day of the month within the last year', () => {
    expect(agesFor(['2026-02-14', '2025-04-14', '2026-01-14'], '2026-03-14')).toEqual([
      ['2025-04-14', { months: 11 }],
      ['2026-01-14', { months: 2 }],
      ['2026-02-14', { months: 1 }],
    ]);
  });

  it('calls exactly one year ago "1 year", not "12 months"', () => {
    expect(agesFor(['2025-03-14'], '2026-03-14')).toEqual([['2025-03-14', { years: 1 }]]);
  });

  it('finds the entry from exactly one week ago, across a month boundary', () => {
    expect(agesFor(['2026-02-24', '2026-02-23', '2026-02-25'], '2026-03-03')).toEqual([
      ['2026-02-24', { weeks: 1 }],
    ]);
  });

  it('counts one week correctly across a daylight-saving change', () => {
    expect(agesFor(['2026-03-04'], '2026-03-11')).toEqual([['2026-03-04', { weeks: 1 }]]);
  });

  it('ignores today and future entries, and unrelated days', () => {
    expect(agesFor(['2026-03-14', '2027-03-14', '2026-03-13', '2025-03-15'], '2026-03-14')).toEqual([]);
  });

  it('works across the new year', () => {
    expect(agesFor(['2025-12-01', '2025-01-01'], '2026-01-01')).toEqual([
      ['2025-01-01', { years: 1 }],
      ['2025-12-01', { months: 1 }],
    ]);
  });

  it('brings back Feb 29 entries on Feb 29 of later leap years', () => {
    expect(agesFor(['2024-02-29', '2020-02-29'], '2028-02-29')).toEqual([
      ['2020-02-29', { years: 8 }],
      ['2024-02-29', { years: 4 }],
    ]);
  });

  it('brings back Feb 29 entries on Feb 28 in years without a Feb 29', () => {
    expect(agesFor(['2024-02-29'], '2025-02-28')).toEqual([['2024-02-29', { years: 1 }]]);
    expect(agesFor(['2024-02-29'], '2027-02-28')).toEqual([['2024-02-29', { years: 3 }]]);
  });

  it('does not show a Feb 29 entry twice in a leap year', () => {
    expect(agesFor(['2024-02-29'], '2028-02-28')).toEqual([]);
    expect(agesFor(['2024-02-29'], '2028-02-29')).toEqual([['2024-02-29', { years: 4 }]]);
  });

  it('lists several entries written on the same day', () => {
    const a = on('2025-03-14');
    const b = on('2025-03-14');
    expect(memoriesFor([a, b], '2026-03-14').map((m) => m.entry.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('words each kind of age', () => {
    expect(memoryLabel({ years: 1 })).toBe('1 year ago');
    expect(memoryLabel({ years: 3 })).toBe('3 years ago');
    expect(memoryLabel({ months: 1 })).toBe('1 month ago');
    expect(memoryLabel({ weeks: 1 })).toBe('One week ago');
  });
});
