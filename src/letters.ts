import { addMonths, fromKey, shiftDay } from './dates';
import { t } from './i18n';
import { Letter } from './types';

/** Letters sealed for a set period open in the morning of their day rather than at midnight. */
export const UNLOCK_HOUR = 9;

/** The moment a letter opens. Letters from before opensAt existed open at 9 AM on their opensOn day. */
export function unlockTime(l: Pick<Letter, 'opensOn' | 'opensAt'>): number {
  if (typeof l.opensAt === 'number' && Number.isFinite(l.opensAt)) return l.opensAt;
  const d = fromKey(l.opensOn);
  d.setHours(UNLOCK_HOUR, 0, 0, 0);
  return d.getTime();
}

export const isUnlocked = (l: Letter, now: number) => unlockTime(l) <= now;

// ---- sealing periods ----

/** Each key has a name in the language files under composer.periods. */
export type PeriodKey = '1w' | '1m' | '3m' | '6m' | '1y' | '3y';
export type Period = { key: PeriodKey; days: number } | { key: PeriodKey; months: number };

export const PERIODS: Period[] = [
  { key: '1w', days: 7 },
  { key: '1m', months: 1 },
  { key: '3m', months: 3 },
  { key: '6m', months: 6 },
  { key: '1y', months: 12 },
  { key: '3y', months: 36 },
];

/** 9 AM on the day the period ends, counted from `today` (YYYY-MM-DD). */
export function periodUnlock(today: string, p: Period): number {
  const day = 'days' in p ? shiftDay(today, p.days) : addMonths(today, p.months);
  return unlockTime({ opensOn: day });
}

// ---- a custom date and time ----

/** A custom time must be at least this far ahead, so the letter is really sealed for a while. */
export const MIN_CUSTOM_LEAD_MS = 10 * 60_000;

export const earliestCustom = (now: number) => now + MIN_CUSTOM_LEAD_MS;

/** Same limit as the longest period: 3 years from now. */
export function latestCustom(now: number): number {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() + 3);
  return d.getTime();
}

/** Why a custom moment can't be used, or null if it's fine. */
export function customProblem(ms: number, now: number): string | null {
  if (ms < earliestCustom(now)) return t('composer.tooSoon');
  if (ms > latestCustom(now)) return t('composer.tooFar');
  return null;
}

/** A sensible first suggestion for a custom time: tomorrow at 9 AM. */
export const defaultCustom = (today: string) => unlockTime({ opensOn: shiftDay(today, 1) });
