/** Date helpers. All dates are plain calendar dates (no time zone math) as "YYYY-MM-DD". */

export const MIN_YEAR = 2020;
export const MAX_YEAR = 2100;
export const TIME_ZONE = 'Europe/Vilnius';

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso({ year, month, day }: CalendarDate): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function toMonthDay({ month, day }: Pick<CalendarDate, 'month' | 'day'>): string {
  return `${pad(month)}-${pad(day)}`;
}

export function isValidDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function isSupportedYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/** Parses "YYYY-MM-DD". Returns null for anything that is not a real date. */
export function parseIsoDate(input: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return isValidDate(year, month, day) ? { year, month, day } : null;
}

/** Parses "MM-DD" (any year). 02-29 is allowed. */
export function parseMonthDay(input: string): Pick<CalendarDate, 'month' | 'day'> | null {
  const m = /^(\d{2})-(\d{2})$/.exec(input);
  if (!m) return null;
  const [month, day] = [Number(m[1]), Number(m[2])];
  return isValidDate(2024, month, day) ? { month, day } : null;
}

/** Today's date in Lithuania, regardless of where the server runs. */
export function todayInLithuania(now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const WEEKDAYS_LT = ['sekmadienis', 'pirmadienis', 'antradienis', 'trečiadienis', 'ketvirtadienis', 'penktadienis', 'šeštadienis'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekdayNames(date: CalendarDate): { lt: string; en: string } {
  const i = weekday(date);
  return { lt: WEEKDAYS_LT[i]!, en: WEEKDAYS_EN[i]! };
}
