import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countWorkingDays, dayStatus, easterSunday, holidaysForYear, nextHoliday } from '../src/lib/holidays.ts';
import { toIso } from '../src/lib/dates.ts';

test('Easter dates match known values', () => {
  const known: Record<number, string> = {
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28',
    2030: '2030-04-21',
    2038: '2038-04-25',
  };
  for (const [year, iso] of Object.entries(known)) {
    assert.equal(toIso(easterSunday(Number(year))), iso);
  }
});

test('every year has 16 holidays', () => {
  for (let y = 2020; y <= 2100; y++) assert.equal(holidaysForYear(y).length, 16, `year ${y}`);
});

test('2026 holidays include movable ones', () => {
  const dates = holidaysForYear(2026).map((h) => `${h.date} ${h.id}`);
  assert.ok(dates.includes('2026-04-05 easter'));
  assert.ok(dates.includes('2026-04-06 easter-monday'));
  assert.ok(dates.includes('2026-05-03 mothers-day'));
  assert.ok(dates.includes('2026-06-07 fathers-day'));
});

test('holidays are sorted by date', () => {
  const dates = holidaysForYear(2027).map((h) => h.date);
  assert.deepEqual(dates, [...dates].sort());
});

test('day status: holiday, weekend, working day', () => {
  assert.equal(dayStatus({ year: 2026, month: 12, day: 24 }).reason, 'holiday');
  assert.equal(dayStatus({ year: 2026, month: 10, day: 3 }).reason, 'weekend'); // Saturday
  const monday = dayStatus({ year: 2026, month: 10, day: 5 });
  assert.equal(monday.isDayOff, false);
  assert.equal(monday.reason, null);
});

test('shortened workday before a holiday', () => {
  // 2026-12-23 is a Wednesday, 12-24 is a holiday.
  assert.equal(dayStatus({ year: 2026, month: 12, day: 23 }).isShortenedWorkday, true);
  // Saturday before Mother's Day is not a workday.
  assert.equal(dayStatus({ year: 2026, month: 5, day: 2 }).isShortenedWorkday, false);
  // A normal Tuesday.
  assert.equal(dayStatus({ year: 2026, month: 10, day: 6 }).isShortenedWorkday, false);
});

test('next holiday rolls over into next year', () => {
  assert.equal(nextHoliday({ year: 2026, month: 12, day: 27 })?.date, '2027-01-01');
  assert.equal(nextHoliday({ year: 2026, month: 12, day: 25 })?.date, '2026-12-25');
});

test('next holiday can skip Sunday-only holidays', () => {
  assert.equal(nextHoliday({ year: 2026, month: 5, day: 2 })?.id, 'mothers-day');
  assert.equal(nextHoliday({ year: 2026, month: 5, day: 2 }, { includeSundayOnly: false })?.id, 'st-johns-day');
});

test('working days in December 2026', () => {
  // 23 weekdays minus 24, 25 Dec (Thu, Fri); 26th is a Saturday.
  assert.equal(countWorkingDays({ year: 2026, month: 12, day: 1 }, { year: 2026, month: 12, day: 31 }), 21);
});
