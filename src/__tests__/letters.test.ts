import { makeLetter } from '../../test/factories';
import { applyLanguage, t } from '../i18n';
import {
  customProblem,
  defaultCustom,
  isUnlocked,
  latestCustom,
  MIN_CUSTOM_LEAD_MS,
  PERIODS,
  periodUnlock,
  sealedPeriod,
  UNLOCK_HOUR,
  unlockTime,
} from '../letters';

beforeAll(() => applyLanguage('en'));

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('when a sealed letter opens', () => {
  it('uses the exact opening time when the letter has one', () => {
    const opensAt = local(2027, 3, 5, 22, 15);
    expect(unlockTime({ opensOn: '2027-03-05', opensAt })).toBe(opensAt);
  });

  it('opens older letters (opensOn only) at 9 AM local time on that day', () => {
    expect(unlockTime({ opensOn: '2027-03-05' })).toBe(local(2027, 3, 5, UNLOCK_HOUR));
  });

  it('still opens at 9 AM on the day clocks change', () => {
    const spring = new Date(unlockTime({ opensOn: '2026-03-08' }));
    const fall = new Date(unlockTime({ opensOn: '2026-11-01' }));
    expect([spring.getHours(), fall.getHours()]).toEqual([9, 9]);
  });

  it('is unlocked from the exact millisecond it opens, not a moment before', () => {
    const l = makeLetter({ opensAt: 1_000_000 });
    expect(isUnlocked(l, 999_999)).toBe(false);
    expect(isUnlocked(l, 1_000_000)).toBe(true);
  });

  it('ignores an opensAt that is not a real number', () => {
    expect(unlockTime({ opensOn: '2027-03-05', opensAt: NaN })).toBe(local(2027, 3, 5, 9));
  });
});

describe('sealing periods', () => {
  it.each([
    ['1w', '2026-12-28', local(2027, 1, 4, 9)],
    ['1m', '2026-01-31', local(2026, 2, 28, 9)],
    ['1m', '2024-01-31', local(2024, 2, 29, 9)],
    ['3m', '2026-11-30', local(2027, 2, 28, 9)],
    ['6m', '2026-08-31', local(2027, 2, 28, 9)],
    ['1y', '2024-02-29', local(2025, 2, 28, 9)],
    ['3y', '2026-03-14', local(2029, 3, 14, 9)],
  ])('%s from %s opens at 9 AM on the right day', (key, today, expected) => {
    expect(periodUnlock(today, PERIODS.find((p) => p.key === key)!)).toBe(expected);
  });

  it('recognises which period every letter was sealed for', () => {
    for (const p of PERIODS) {
      const writtenOn = '2024-02-29';
      const opensAt = periodUnlock(writtenOn, p);
      expect(sealedPeriod(makeLetter({ writtenOn, opensAt }))).toBe(p.key);
    }
  });

  it('recognises the period of older letters that only have opensOn', () => {
    expect(sealedPeriod(makeLetter({ writtenOn: '2026-03-14', opensOn: '2027-03-14', opensAt: undefined }))).toBe('1y');
  });

  it('treats any other opening time as a custom one', () => {
    expect(sealedPeriod(makeLetter({ writtenOn: '2026-03-14', opensAt: local(2027, 3, 14, 10) }))).toBeNull();
  });
});

describe('custom opening time', () => {
  const now = local(2026, 3, 14, 21, 0);

  it('must be at least 10 minutes away', () => {
    expect(customProblem(now + MIN_CUSTOM_LEAD_MS - 1, now)).toBe(t('composer.tooSoon'));
    expect(customProblem(now + MIN_CUSTOM_LEAD_MS, now)).toBeNull();
  });

  it('must be within 3 years', () => {
    expect(latestCustom(now)).toBe(local(2029, 3, 14, 21, 0));
    expect(customProblem(latestCustom(now), now)).toBeNull();
    expect(customProblem(latestCustom(now) + 1, now)).toBe(t('composer.tooFar'));
  });

  it('suggests tomorrow at 9 AM', () => {
    expect(defaultCustom('2026-12-31')).toBe(local(2027, 1, 1, 9));
  });
});
