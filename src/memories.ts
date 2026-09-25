import { daysBetween, fromKey } from './dates';
import { Entry } from './types';

export interface Memory {
  entry: Entry;
  /** e.g. "1 year ago", "3 months ago", "One week ago" */
  label: string;
}

/**
 * Entries worth resurfacing today:
 *  - same date in earlier years      ("2 years ago")
 *  - same day-of-month earlier months ("3 months ago", within the last year)
 *  - exactly one week ago             ("One week ago") — gives new users an early payoff
 * Older memories come first, since they're the most nostalgic.
 */
export function memoriesFor(entries: Entry[], today: string): Memory[] {
  const t = fromKey(today);
  const out: { entry: Entry; label: string; age: number }[] = [];

  for (const entry of entries) {
    if (entry.date >= today) continue;
    const d = fromKey(entry.date);
    const age = daysBetween(entry.date, today);

    if (d.getMonth() === t.getMonth() && d.getDate() === t.getDate()) {
      const years = t.getFullYear() - d.getFullYear();
      out.push({ entry, age, label: years === 1 ? '1 year ago' : `${years} years ago` });
    } else if (d.getDate() === t.getDate() && age < 365) {
      const months = (t.getFullYear() - d.getFullYear()) * 12 + t.getMonth() - d.getMonth();
      out.push({ entry, age, label: months === 1 ? '1 month ago' : `${months} months ago` });
    } else if (age === 7) {
      out.push({ entry, age, label: 'One week ago' });
    }
  }

  return out.sort((a, b) => b.age - a.age).map(({ entry, label }) => ({ entry, label }));
}
