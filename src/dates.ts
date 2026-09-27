import { t } from './i18n';

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

// ---- wording: names and patterns come from the current language (src/i18n/*.json) ----
// Formatted by hand rather than with Intl.DateTimeFormat, whose output differs between phones.

const names = (key: 'months' | 'monthsShort' | 'weekdays' | 'weekdaysShort' | 'weekdayInitials') =>
  t(`dates.${key}`, { returnObjects: true }) as readonly string[];

export const monthName = (monthIndex: number) => names('months')[monthIndex];
export const monthShort = (monthIndex: number) => names('monthsShort')[monthIndex];
/** "S M T W T F S" / "일 월 화 수 목 금 토", starting on Sunday. */
export const weekdayInitials = () => names('weekdayInitials');

/** "Saturday, September 26, 2026" / "2026년 9월 26일 (토)" */
export const longDate = (key: string) => {
  const d = fromKey(key);
  return t('dates.long', {
    weekday: names('weekdays')[d.getDay()],
    weekdayShort: names('weekdaysShort')[d.getDay()],
    month: monthName(d.getMonth()),
    day: d.getDate(),
    year: d.getFullYear(),
  });
};

/** "Sep 26, 2026" / "2026년 9월 26일" */
export const mediumDate = (key: string) => {
  const d = fromKey(key);
  return t('dates.medium', { monthShort: monthShort(d.getMonth()), day: d.getDate(), year: d.getFullYear() });
};

/** "September 2026" / "2026년 9월" */
export const monthYear = (d: Date) => t('dates.monthYear', { month: monthName(d.getMonth()), year: d.getFullYear() });

/** "Sat" / "토" */
export const shortWeekday = (key: string) => names('weekdaysShort')[fromKey(key).getDay()];

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

/** "3 days", "5 months", "1 year" / "3일", "5개월", "1년" — rough distance between two days. */
export const humanSpan = (a: string, b: string) => {
  const days = Math.abs(daysBetween(a, b));
  if (days < 14) return t('dates.spanDays', { count: days });
  if (days < 60) return t('dates.spanWeeks', { count: Math.round(days / 7) });
  if (days < 365) return t('dates.spanMonths', { count: Math.round(days / 30.4) });
  return t('dates.spanYears', { count: Math.floor(days / 365) });
};

// ---- moments (a timestamp in ms, for things that happen at a time of day, like a letter opening) ----

/** "10:00 PM" / "오후 10:00" */
export const clockTime = (ms: number) => {
  const d = new Date(ms);
  const h = d.getHours();
  return t('dates.time', {
    hour: h % 12 || 12,
    minute: pad(d.getMinutes()),
    period: h < 12 ? t('dates.am') : t('dates.pm'),
  });
};

/** "Friday, March 5, 2027 at 10:00 PM" / "2027년 3월 5일 (금) 오후 10:00" */
export const longDateTime = (ms: number) =>
  t('dates.dateTime', { date: longDate(toKey(new Date(ms))), time: clockTime(ms) });

/** "Mar 5, 2027 · 10:00 PM" / "2027년 3월 5일 · 오후 10:00" */
export const mediumDateTime = (ms: number) =>
  t('dates.dateTimeShort', { date: mediumDate(toKey(new Date(ms))), time: clockTime(ms) });

/** "In 25 minutes", "In 3 hours", "Tomorrow", "In 2 weeks" — how long until a future moment. */
export const untilLabel = (now: number, ms: number) => {
  const minutes = Math.max(1, Math.ceil((ms - now) / 60_000));
  if (minutes < 60) return t('dates.inMinutes', { count: minutes });
  if (minutes < 24 * 60) return t('dates.inHours', { count: Math.round(minutes / 60) });
  const today = toKey(new Date(now));
  const day = toKey(new Date(ms));
  return daysBetween(today, day) === 1 ? t('dates.tomorrow') : t('dates.inSpan', { span: humanSpan(today, day) });
};
