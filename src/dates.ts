const pad = (n: number) => String(n).padStart(2, '0');

/** Local date -> 'YYYY-MM-DD' (not UTC, so late-night entries land on the right day). */
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayKey = () => toKey(new Date());

export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** True for a real calendar day written as 'YYYY-MM-DD' (rejects '2024-02-30'). */
export const isDateKey = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && toKey(fromKey(v)) === v;

export const shiftDay =(key: string, delta: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const longDate = (key: string) => {
  const d = fromKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export const shortWeekday = (key: string) => WEEKDAYS[fromKey(key).getDay()].slice(0, 3);

/** Same day N months later; clamps to the month's last day (Jan 31 + 1 month -> Feb 28). */
export const addMonths = (key: string, months: number) => {
  const d = fromKey(key);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toKey(target);
};

/** Whole days from a to b (positive when b is later). */
export const daysBetween = (a: string, b: string) =>
  Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

export const mediumDate = (key: string) => {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** "3 days", "5 months", "1 year" — rough human distance between two days. */
export const humanSpan = (a: string, b: string) => {
  const days = Math.abs(daysBetween(a, b));
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.round(days / 7), 'week');
  if (days < 365) return plural(Math.round(days / 30.4), 'month');
  return plural(Math.floor(days / 365), 'year');
};

// ---- moments (a timestamp in ms, for things that happen at a time of day, like a letter opening) ----

/** "10:00 PM" */
export const clockTime = (ms: number) => {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
};

/** "Friday, March 5, 2027 at 10:00 PM" */
export const longDateTime = (ms: number) => `${longDate(toKey(new Date(ms)))} at ${clockTime(ms)}`;

/** "Mar 5, 2027 · 10:00 PM" */
export const mediumDateTime = (ms: number) => `${mediumDate(toKey(new Date(ms)))} · ${clockTime(ms)}`;

/** "In 25 minutes", "In 3 hours", "Tomorrow", "In 2 weeks" — how long until a future moment. */
export const untilLabel = (now: number, ms: number) => {
  const minutes = Math.max(1, Math.ceil((ms - now) / 60_000));
  if (minutes < 60) return `In ${plural(minutes, 'minute')}`;
  if (minutes < 24 * 60) return `In ${plural(Math.round(minutes / 60), 'hour')}`;
  const today = toKey(new Date(now));
  const day = toKey(new Date(ms));
  return daysBetween(today, day) === 1 ? 'Tomorrow' : `In ${humanSpan(today, day)}`;
};
