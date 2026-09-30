/** Lithuanian name days (vardadieniai): lookup by date and search by name. */
import { readFileSync } from 'node:fs';

type NamedayData = Record<string, string[]>; // "MM-DD" -> names

const data: NamedayData = JSON.parse(
  readFileSync(new URL('../data/namedays.json', import.meta.url), 'utf8'),
);

/**
 * Lower-cases and strips Lithuanian diacritics so that "zygimantas",
 * "ŽYGIMANTAS" and "Žygimantas" all match.
 */
export function normalizeName(input: string): string {
  return input.trim().toLocaleLowerCase('lt').normalize('NFD').replace(/\p{M}/gu, '');
}

// Built once at startup: normalized name -> { display name, dates }
const index = new Map<string, { name: string; dates: string[] }>();
for (const [date, names] of Object.entries(data)) {
  for (const name of names) {
    const key = normalizeName(name);
    const entry = index.get(key) ?? { name, dates: [] };
    entry.dates.push(date);
    index.set(key, entry);
  }
}

export function namesOn(monthDay: string): string[] {
  return data[monthDay] ?? [];
}

export function allNamedays(): NamedayData {
  return data;
}

export interface NameMatch {
  name: string;
  dates: string[]; // "MM-DD"
}

/** Exact match (ignoring case and diacritics). */
export function findName(query: string): NameMatch | null {
  const hit = index.get(normalizeName(query));
  return hit ? { name: hit.name, dates: [...hit.dates] } : null;
}

/** Prefix search for autocomplete, e.g. "gyt" -> Gytis, Gytautas, Gytautė, Gytė. */
export function searchNames(query: string, limit = 20): NameMatch[] {
  const q = normalizeName(query);
  if (!q) return [];
  const collator = new Intl.Collator('lt');
  return [...index.entries()]
    .filter(([key]) => key.startsWith(q))
    .map(([, v]) => ({ name: v.name, dates: [...v.dates] }))
    .sort((a, b) => collator.compare(a.name, b.name))
    .slice(0, limit);
}

export function stats() {
  return { dates: Object.keys(data).length, uniqueNames: index.size };
}
