import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allNamedays, findName, namesOn, normalizeName, searchNames } from '../src/lib/namedays.ts';

test('data covers every day except Feb 29', () => {
  const data = allNamedays();
  assert.equal(Object.keys(data).length, 365);
  for (const [date, names] of Object.entries(data)) assert.ok(names.length > 0, `${date} has no names`);
});

test('well-known name days', () => {
  assert.ok(namesOn('03-04').includes('Kazimieras'));
  assert.ok(namesOn('06-24').includes('Jonas'));
  assert.ok(namesOn('07-06').includes('Mindaugas'));
  assert.ok(namesOn('12-24').includes('Adomas'));
  assert.ok(namesOn('12-24').includes('Ieva'));
});

test('normalizeName strips diacritics and case', () => {
  assert.equal(normalizeName('  ŽYGIMANTAS '), 'zygimantas');
  assert.equal(normalizeName('Gintarė'), 'gintare');
});

test('findName works without diacritics', () => {
  const m = findName('zygimantas');
  assert.equal(m?.name, 'Žygimantas');
  assert.ok(m?.dates.includes('03-20'));
});

test('findName returns every date for a name', () => {
  const m = findName('Tadas');
  assert.deepEqual(m?.dates, ['10-28']);
});

test('unknown name returns null', () => {
  assert.equal(findName('Xyzabc'), null);
});

test('prefix search', () => {
  const names = searchNames('gyt').map((r) => r.name);
  assert.ok(names.includes('Gytis'));
  assert.ok(names.every((n) => normalizeName(n).startsWith('gyt')));
});
