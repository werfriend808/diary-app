const pad = (n: number) => String(n).padStart(2, '0');

/** Local date -> 'YYYY-MM-DD' (not UTC, so late-night entries land on the right day). */
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayKey = () => toKey(new Date());

export const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const shiftDay = (key: string, delta: number) => {
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

/** "3 days", "5 months", "1 year" — rough human distance between two days. */
export const humanSpan = (a: string, b: string) => {
  const days = Math.abs(daysBetween(a, b));
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.round(days / 7), 'week');
  if (days < 365) return plural(Math.round(days / 30.4), 'month');
  return plural(Math.floor(days / 365), 'year');
};
