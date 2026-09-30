/**
 * Converts data/namedays.txt (easy to read and edit) into src/data/namedays.json
 * (what the API loads). Also validates the data so mistakes fail loudly.
 *
 * Usage: npm run build:data
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = new URL('../data/namedays.txt', import.meta.url);
const TARGET = new URL('../src/data/namedays.json', import.meta.url);

const collator = new Intl.Collator('lt');
const LINE = /^(\d{2})-(\d{2}):\s*(.+)$/;
const NAME = /^[\p{Lu}][\p{Ll}]+$/u;

const result: Record<string, string[]> = {};
const errors: string[] = [];

readFileSync(SOURCE, 'utf8')
  .split(/\r?\n/)
  .forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;

    const m = LINE.exec(line);
    if (!m) {
      errors.push(`line ${i + 1}: cannot parse "${line}"`);
      return;
    }
    const [, mm, dd, list] = m as unknown as [string, string, string, string];
    const key = `${mm}-${dd}`;

    // 2024 is a leap year, so 02-29 is accepted as a valid key.
    const d = new Date(Date.UTC(2024, Number(mm) - 1, Number(dd)));
    if (d.getUTCMonth() + 1 !== Number(mm) || d.getUTCDate() !== Number(dd)) {
      errors.push(`line ${i + 1}: invalid date ${key}`);
      return;
    }
    if (result[key]) {
      errors.push(`line ${i + 1}: duplicate date ${key}`);
      return;
    }

    const names = [...new Set(list.split(',').map((n) => n.trim()).filter(Boolean))];
    for (const n of names) {
      if (!NAME.test(n)) errors.push(`line ${i + 1}: suspicious name "${n}" on ${key}`);
    }
    result[key] = names.sort(collator.compare);
  });

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(TARGET, JSON.stringify(sorted, null, 2) + '\n');

const total = Object.values(sorted).reduce((n, list) => n + list.length, 0);
console.log(`Wrote ${Object.keys(sorted).length} dates and ${total} name entries to src/data/namedays.json`);
