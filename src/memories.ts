import { daysBetween, fromKey } from './dates';
import { t as translate } from './i18n';
import { Entry } from './types';

/** How long ago a memory is. Kept as data (not text) so it's worded in whatever language is current. */
export type MemoryAge = { years: number } | { months: number } | { weeks: 1 };

export interface Memory {
  entry: Entry;
  ago: MemoryAge;
}

/** "2 years ago", "3 months ago", "One week ago" / "2년 전", "3개월 전", "1주 전" */
export function memoryLabel(ago: MemoryAge): string {
  if ('years' in ago) return translate('memories.yearsAgo', { count: ago.years });
  if ('months' in ago) return translate('memories.monthsAgo', { count: ago.months });
  return translate('memories.weekAgo');
}

/**
 * Entries worth resurfacing today:
 *  - same date in earlier years      ("2 years ago")
 *  - same day-of-month earlier months ("3 months ago", within the last year)
 *  - exactly one week ago             ("One week ago") — gives new users an early payoff
 * Older memories come first, since they're the most nostalgic.
 * Expects live entries only — App.tsx filters out deleted ones before anything reaches here.
 */
export function memoriesFor(entries: Entry[], today: string): Memory[] {
  const t = fromKey(today);
  const out: { entry: Entry; ago: MemoryAge; age: number }[] = [];

  for (const entry of entries) {
    if (entry.date >= today) continue;
    const d = fromKey(entry.date);
    const age = daysBetween(entry.date, today);

    if (d.getMonth() === t.getMonth() && d.getDate() === t.getDate()) {
      out.push({ entry, age, ago: { years: t.getFullYear() - d.getFullYear() } });
    } else if (d.getDate() === t.getDate() && age < 365) {
      const months = (t.getFullYear() - d.getFullYear()) * 12 + t.getMonth() - d.getMonth();
      out.push({ entry, age, ago: { months } });
    } else if (age === 7) {
      out.push({ entry, age, ago: { weeks: 1 } });
    }
  }

  return out.sort((a, b) => b.age - a.age).map(({ entry, ago }) => ({ entry, ago }));
}
