import { toKey } from './dates';
import { Entry, MoodKey } from './types';

/*
 * The calendar's logic, kept apart from CalendarScreen so it can be tested without rendering.
 */

/**
 * Day keys for a month laid out in weeks starting on Sunday: null for the blank cells before the 1st
 * and after the last day, so the length is always a multiple of 7.
 */
export function monthGrid(month: Date): (string | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const out: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) out.push(toKey(new Date(month.getFullYear(), month.getMonth(), d)));
  while (out.length % 7) out.push(null);
  return out;
}

/** Entries grouped by day, each day keeping the order they came in. */
export function entriesByDay(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

/**
 * The mood a day's dot shows: the first entry that has one. Entries arrive newest first, so it's the
 * latest mood of the day. Undefined when no entry that day has a mood (the dot uses the accent color).
 */
export const dayMood = (dayEntries: Entry[] | undefined): MoodKey | undefined => dayEntries?.find((e) => e.mood)?.mood;
