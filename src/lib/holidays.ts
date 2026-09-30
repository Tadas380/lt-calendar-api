/**
 * Lithuanian public holidays (švenčių dienos) as listed in the Labour Code
 * (Darbo kodeksas), Article 123. Rules as currently in force; the API supports
 * years from 2020 (when All Souls' Day, Nov 2, became a day off) onwards.
 */
import { addDays, toIso, weekday, type CalendarDate } from './dates.ts';

export interface Holiday {
  date: string; // YYYY-MM-DD
  id: string;
  nameLt: string;
  nameEn: string;
  /** Mother's and Father's Day are official holidays but always fall on a Sunday. */
  alwaysSunday: boolean;
}

interface FixedRule {
  id: string;
  month: number;
  day: number;
  nameLt: string;
  nameEn: string;
}

const FIXED: FixedRule[] = [
  { id: 'new-year', month: 1, day: 1, nameLt: 'Naujųjų metų diena', nameEn: "New Year's Day" },
  { id: 'state-restoration', month: 2, day: 16, nameLt: 'Lietuvos valstybės atkūrimo diena', nameEn: 'Day of Restoration of the State of Lithuania' },
  { id: 'independence-restoration', month: 3, day: 11, nameLt: 'Lietuvos nepriklausomybės atkūrimo diena', nameEn: 'Day of Restoration of Independence of Lithuania' },
  { id: 'labour-day', month: 5, day: 1, nameLt: 'Tarptautinė darbo diena', nameEn: 'International Labour Day' },
  { id: 'st-johns-day', month: 6, day: 24, nameLt: 'Rasos ir Joninių diena', nameEn: "St. John's Day (Midsummer)" },
  { id: 'statehood-day', month: 7, day: 6, nameLt: 'Valstybės (Lietuvos karaliaus Mindaugo karūnavimo) ir Tautiškos giesmės diena', nameEn: 'Statehood Day (Coronation of King Mindaugas)' },
  { id: 'assumption', month: 8, day: 15, nameLt: 'Žolinė (Švč. Mergelės Marijos ėmimo į dangų diena)', nameEn: 'Assumption Day' },
  { id: 'all-saints', month: 11, day: 1, nameLt: 'Visų šventųjų diena', nameEn: "All Saints' Day" },
  { id: 'all-souls', month: 11, day: 2, nameLt: 'Mirusiųjų atminimo (Vėlinių) diena', nameEn: "All Souls' Day" },
  { id: 'christmas-eve', month: 12, day: 24, nameLt: 'Kūčių diena', nameEn: 'Christmas Eve' },
  { id: 'christmas', month: 12, day: 25, nameLt: 'Šv. Kalėdos (pirmoji diena)', nameEn: 'Christmas Day' },
  { id: 'christmas-second', month: 12, day: 26, nameLt: 'Šv. Kalėdos (antroji diena)', nameEn: 'Second Day of Christmas' },
];

/** Western (Gregorian) Easter Sunday — Anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

/** First Sunday of a month. */
function firstSunday(year: number, month: number): CalendarDate {
  const first = { year, month, day: 1 };
  return addDays(first, (7 - weekday(first)) % 7);
}

const cache = new Map<number, Holiday[]>();

export function holidaysForYear(year: number): Holiday[] {
  const cached = cache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const list: Holiday[] = [
    ...FIXED.map((r) => ({
      date: toIso({ year, month: r.month, day: r.day }),
      id: r.id,
      nameLt: r.nameLt,
      nameEn: r.nameEn,
      alwaysSunday: false,
    })),
    { date: toIso(easter), id: 'easter', nameLt: 'Šv. Velykos (pirmoji diena)', nameEn: 'Easter Sunday', alwaysSunday: true },
    { date: toIso(addDays(easter, 1)), id: 'easter-monday', nameLt: 'Šv. Velykos (antroji diena)', nameEn: 'Easter Monday', alwaysSunday: false },
    { date: toIso(firstSunday(year, 5)), id: 'mothers-day', nameLt: 'Motinos diena', nameEn: "Mother's Day", alwaysSunday: true },
    { date: toIso(firstSunday(year, 6)), id: 'fathers-day', nameLt: 'Tėvo diena', nameEn: "Father's Day", alwaysSunday: true },
  ];

  list.sort((a, b) => a.date.localeCompare(b.date));
  cache.set(year, list);
  return list;
}

export function holidayOn(date: CalendarDate): Holiday | null {
  const iso = toIso(date);
  return holidaysForYear(date.year).find((h) => h.date === iso) ?? null;
}

export type DayOffReason = 'holiday' | 'weekend' | null;

export interface DayStatus {
  date: string;
  isDayOff: boolean;
  reason: DayOffReason;
  holiday: Holiday | null;
  /**
   * Working day right before a public holiday. Under the Labour Code the
   * working time on such a day is shortened by one hour.
   */
  isShortenedWorkday: boolean;
}

export function dayStatus(date: CalendarDate): DayStatus {
  const holiday = holidayOn(date);
  const wd = weekday(date);
  const isWeekend = wd === 0 || wd === 6;
  const isDayOff = holiday !== null || isWeekend;
  const tomorrowHoliday = holidayOn(addDays(date, 1));
  return {
    date: toIso(date),
    isDayOff,
    reason: holiday ? 'holiday' : isWeekend ? 'weekend' : null,
    holiday,
    isShortenedWorkday: !isDayOff && tomorrowHoliday !== null && !tomorrowHoliday.alwaysSunday,
  };
}

/** The next holiday on or after `from` (optionally skipping ones that always fall on Sunday). */
export function nextHoliday(from: CalendarDate, { includeSundayOnly = true } = {}): Holiday | null {
  const iso = toIso(from);
  for (const year of [from.year, from.year + 1]) {
    const found = holidaysForYear(year).find((h) => h.date >= iso && (includeSundayOnly || !h.alwaysSunday));
    if (found) return found;
  }
  return null;
}

/** Number of working days (Mon-Fri, not a holiday) between two dates, inclusive. */
export function countWorkingDays(from: CalendarDate, to: CalendarDate): number {
  let count = 0;
  let cur = from;
  while (toIso(cur) <= toIso(to)) {
    if (!dayStatus(cur).isDayOff) count++;
    cur = addDays(cur, 1);
  }
  return count;
}
