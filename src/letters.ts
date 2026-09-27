import { addMonths, fromKey, shiftDay } from './dates';
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

export type Period =
  | { key: string; label: string; days: number }
  | { key: string; label: string; months: number };

export const PERIODS: Period[] = [
  { key: '1w', label: '1 week', days: 7 },
  { key: '1m', label: '1 month', months: 1 },
  { key: '3m', label: '3 months', months: 3 },
  { key: '6m', label: '6 months', months: 6 },
  { key: '1y', label: '1 year', months: 12 },
  { key: '3y', label: '3 years', months: 36 },
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
  if (ms < earliestCustom(now)) return 'Choose a time at least 10 minutes from now.';
  if (ms > latestCustom(now)) return 'Choose a time within 3 years from now.';
  return null;
}

/** A sensible first suggestion for a custom time: tomorrow at 9 AM. */
export const defaultCustom = (today: string) => unlockTime({ opensOn: shiftDay(today, 1) });
