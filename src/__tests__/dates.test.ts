import {
  addMonths,
  clockTime,
  daysBetween,
  fromKey,
  humanSpan,
  isDateKey,
  longDate,
  mediumDateTime,
  shiftDay,
  toKey,
  untilLabel,
} from '../dates';
import { applyLanguage } from '../i18n';

/** The local calendar day of an instant according to Intl, for whatever time zone the tests run in. */
const intlDay = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms);

beforeAll(() => applyLanguage('en'));

describe('day keys (local calendar days)', () => {
  it('uses the local day, not UTC — a late-night entry stays on its own day', () => {
    expect(toKey(new Date(2026, 2, 14, 23, 59, 59))).toBe('2026-03-14');
    expect(toKey(new Date(2026, 2, 15, 0, 0, 1))).toBe('2026-03-15');
  });

  it('switches day exactly at local midnight', () => {
    expect(toKey(new Date(2026, 11, 31, 23, 59, 59, 999))).toBe('2026-12-31');
    expect(toKey(new Date(2027, 0, 1, 0, 0, 0, 0))).toBe('2027-01-01');
  });

  it(`matches the local calendar day for every half hour around the clock (TZ=${process.env.TZ})`, () => {
    // Includes both 2026 daylight-saving changes and a leap day.
    for (const start of [Date.UTC(2026, 2, 6), Date.UTC(2026, 9, 30), Date.UTC(2024, 1, 27)]) {
      for (let ms = start; ms < start + 4 * 86_400_000; ms += 30 * 60_000) {
        expect(toKey(new Date(ms))).toBe(intlDay(ms));
      }
    }
  });

  it(`round-trips every day of a leap year (TZ=${process.env.TZ})`, () => {
    let key = '2024-01-01';
    for (let i = 0; i < 366; i++) {
      expect(toKey(fromKey(key))).toBe(key);
      key = shiftDay(key, 1);
    }
    expect(key).toBe('2025-01-01');
  });

  it.each([
    ['2024-02-29', true],
    ['2025-02-29', false],
    ['2100-02-29', false], // divisible by 100, not by 400
    ['2000-02-29', true],
    ['2026-04-31', false],
    ['2026-13-01', false],
    ['2026-00-10', false],
    ['2026-1-5', false],
    ['20260105', false],
    [' 2026-01-05', false],
  ])('isDateKey(%p) is %p', (key, valid) => {
    expect(isDateKey(key)).toBe(valid);
  });

  it('rejects non-strings', () => {
    expect(isDateKey(20260105)).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });
});

describe('day arithmetic', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(shiftDay('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDay('2025-02-28', 1)).toBe('2025-03-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is not thrown off by daylight saving time (23- and 25-hour days)', () => {
    // US clocks spring forward on 2026-03-08 and fall back on 2026-11-01.
    expect(shiftDay('2026-03-07', 1)).toBe('2026-03-08');
    expect(shiftDay('2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftDay('2026-11-01', 1)).toBe('2026-11-02');
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('counts whole days in either direction, including leap years', () => {
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
    expect(daysBetween('2026-03-14', '2026-03-07')).toBe(-7);
    expect(daysBetween('2026-03-14', '2026-03-14')).toBe(0);
  });

  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2024-02-29', 12, '2025-02-28'],
    ['2024-02-29', 48, '2028-02-29'],
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-11-30', 3, '2027-02-28'],
    ['2026-03-31', -1, '2026-02-28'],
    ['2026-01-15', -1, '2025-12-15'],
  ])('addMonths(%s, %d) clamps to the end of the month: %s', (from, months, expected) => {
    expect(addMonths(from, months)).toBe(expected);
  });
});

describe('wording', () => {
  it.each([
    [0, '0 days'],
    [1, '1 day'],
    [13, '13 days'],
    [14, '2 weeks'],
    [59, '8 weeks'],
    [60, '2 months'],
    [364, '12 months'],
    [365, '1 year'],
    [729, '1 year'],
    [730, '2 years'],
  ])('humanSpan over %d days is "%s"', (days, expected) => {
    expect(humanSpan('2026-01-01', shiftDay('2026-01-01', days))).toBe(expected);
  });

  it('formats times on a 12-hour clock with midnight and noon as 12', () => {
    expect(clockTime(new Date(2026, 0, 1, 0, 5).getTime())).toBe('12:05 AM');
    expect(clockTime(new Date(2026, 0, 1, 12, 0).getTime())).toBe('12:00 PM');
    expect(clockTime(new Date(2026, 0, 1, 23, 59).getTime())).toBe('11:59 PM');
  });

  it('formats long dates and date-times', () => {
    expect(longDate('2024-02-29')).toBe('Thursday, February 29, 2024');
    expect(mediumDateTime(new Date(2027, 2, 5, 22, 0).getTime())).toBe('Mar 5, 2027 · 10:00 PM');
  });

  it('formats in Korean when the language is Korean', () => {
    applyLanguage('ko');
    try {
      expect(longDate('2026-09-26')).toBe('2026년 9월 26일 (토)');
      expect(clockTime(new Date(2026, 0, 1, 22, 0).getTime())).toBe('오후 10:00');
    } finally {
      applyLanguage('en');
    }
  });

  describe('untilLabel', () => {
    const now = new Date(2026, 2, 14, 21, 0).getTime(); // 9 PM
    const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 2, 14 + dayOffset, h, m).getTime();

    it('never says "in 0 minutes"', () => {
      expect(untilLabel(now, now + 1000)).toBe('In 1 minute');
      expect(untilLabel(now, now - 60_000)).toBe('In 1 minute');
    });
    it('switches from minutes to hours at one hour', () => {
      expect(untilLabel(now, at(21, 59))).toBe('In 59 minutes');
      expect(untilLabel(now, at(22, 0))).toBe('In 1 hour');
    });
    it('says "Tomorrow" for the next calendar day once it is a day or more away', () => {
      expect(untilLabel(now, at(21, 0, 1))).toBe('Tomorrow');
      expect(untilLabel(now, at(9, 0, 1))).toBe('In 12 hours'); // tomorrow morning, but under 24h
    });
    it('uses a rough span further out', () => {
      expect(untilLabel(now, at(9, 0, 7))).toBe('In 7 days');
      expect(untilLabel(now, new Date(2027, 2, 14, 9).getTime())).toBe('In 1 year');
    });
  });
});
