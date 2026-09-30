/**
 * HTTP layer. Zero dependencies: plain node:http with a tiny router.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import {
  MAX_YEAR,
  MIN_YEAR,
  daysInMonth,
  isSupportedYear,
  parseIsoDate,
  parseMonthDay,
  toIso,
  toMonthDay,
  todayInLithuania,
  weekdayNames,
  type CalendarDate,
} from './lib/dates.ts';
import { countWorkingDays, dayStatus, holidaysForYear, nextHoliday } from './lib/holidays.ts';
import { allNamedays, findName, namesOn, searchNames, stats } from './lib/namedays.ts';
import { createRateLimiter } from './lib/rate-limit.ts';

const INDEX_HTML = readFileSync(new URL('../public/index.html', import.meta.url));

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (message: string) => new HttpError(400, 'bad_request', message);

type Handler = (params: string[], query: URLSearchParams) => unknown;

// ---------- input helpers ----------

function requireIsoDate(value: string | null, field: string): CalendarDate {
  const date = value ? parseIsoDate(value) : null;
  if (!date) throw badRequest(`"${field}" must be a real date in YYYY-MM-DD format`);
  requireYear(date.year);
  return date;
}

function requireYear(year: number): void {
  if (!isSupportedYear(year)) throw badRequest(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}`);
}

/** Builds the full info object for one day. */
function dayInfo(date: CalendarDate) {
  return {
    ...dayStatus(date),
    weekday: weekdayNames(date),
    namedays: namesOn(toMonthDay(date)),
  };
}

// ---------- routes ----------

const routes: Array<[RegExp, Handler]> = [
  [/^\/api\/v1\/today$/, () => dayInfo(todayInLithuania())],

  [/^\/api\/v1\/days\/([^/]+)$/, ([d]) => dayInfo(requireIsoDate(d!, 'date'))],

  [/^\/api\/v1\/namedays$/, (_, q) => {
    const month = q.get('month');
    if (month === null) return allNamedays();
    if (!/^(0[1-9]|1[0-2])$/.test(month)) throw badRequest('"month" must be 01-12');
    return Object.fromEntries(Object.entries(allNamedays()).filter(([k]) => k.startsWith(`${month}-`)));
  }],

  [/^\/api\/v1\/namedays\/today$/, () => {
    const today = todayInLithuania();
    return { date: toIso(today), namedays: namesOn(toMonthDay(today)) };
  }],

  [/^\/api\/v1\/namedays\/search$/, (_, q) => {
    const query = (q.get('q') ?? '').trim();
    if (query.length < 2 || query.length > 40) throw badRequest('"q" must be 2-40 characters');
    const limit = Math.min(Math.max(Number(q.get('limit') ?? 20) || 20, 1), 50);
    return { query, results: searchNames(query, limit) };
  }],

  [/^\/api\/v1\/namedays\/name\/([^/]+)$/, ([name]) => {
    if (name!.length > 40) throw badRequest('Name is too long');
    const match = findName(name!);
    if (!match) throw new HttpError(404, 'not_found', `No name day found for "${name}"`);
    const today = todayInLithuania();
    const todayKey = toMonthDay(today);
    // Next upcoming occurrence (this year or next).
    const upcoming = match.dates.find((d) => d >= todayKey) ?? match.dates[0]!;
    const year = upcoming >= todayKey ? today.year : today.year + 1;
    return { ...match, next: `${year}-${upcoming}` };
  }],

  [/^\/api\/v1\/namedays\/([^/]+)$/, ([d]) => {
    const md = parseMonthDay(d!) ?? (parseIsoDate(d!) as CalendarDate | null);
    if (!md) throw badRequest('Date must be MM-DD or YYYY-MM-DD');
    const key = toMonthDay(md);
    return { date: key, namedays: namesOn(key) };
  }],

  [/^\/api\/v1\/holidays\/next$/, (_, q) => {
    const from = q.has('from') ? requireIsoDate(q.get('from'), 'from') : todayInLithuania();
    const includeSundayOnly = q.get('includeSundayOnly') !== 'false';
    return nextHoliday(from, { includeSundayOnly });
  }],

  [/^\/api\/v1\/holidays\/(\d{4})$/, ([y]) => {
    const year = Number(y);
    requireYear(year);
    return { year, holidays: holidaysForYear(year) };
  }],

  [/^\/api\/v1\/working-days$/, (_, q) => {
    const from = requireIsoDate(q.get('from'), 'from');
    const to = requireIsoDate(q.get('to'), 'to');
    if (toIso(from) > toIso(to)) throw badRequest('"from" must be before or equal to "to"');
    if (to.year - from.year > 5) throw badRequest('Range can be at most 5 years');
    return { from: toIso(from), to: toIso(to), workingDays: countWorkingDays(from, to) };
  }],

  [/^\/api\/v1\/calendar\/(\d{4})\/(\d{2})$/, ([y, m]) => {
    const year = Number(y);
    const month = Number(m);
    requireYear(year);
    if (month < 1 || month > 12) throw badRequest('Month must be 01-12');
    const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => dayInfo({ year, month, day: i + 1 }));
    return { year, month, days };
  }],

  [/^\/health$/, () => ({ status: 'ok', ...stats() })],
];

// ---------- request handling ----------

const rateLimit = createRateLimiter({
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
});

function clientIp(req: IncomingMessage): string {
  // Render and most hosts put the real client IP first in X-Forwarded-For.
  const forwarded = process.env.TRUST_PROXY === 'true' ? req.headers['x-forwarded-for'] : undefined;
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

function send(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    ...extraHeaders,
  });
  res.end(res.req.method === 'HEAD' ? undefined : json);
}

function setCommonHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
}

export function handler(req: IncomingMessage, res: ServerResponse): void {
  setCommonHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Max-Age': '86400' });
    res.end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, { error: { code: 'method_not_allowed', message: 'Only GET is supported' } }, { Allow: 'GET, HEAD, OPTIONS' });
    return;
  }

  let url: URL;
  try {
    url = new URL(req.url ?? '/', 'http://localhost');
  } catch {
    send(res, 400, { error: { code: 'bad_request', message: 'Malformed URL' } });
    return;
  }
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/' || path === '/index.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'none'",
    });
    res.end(req.method === 'HEAD' ? undefined : INDEX_HTML);
    return;
  }

  if (path.startsWith('/api/')) {
    const rl = rateLimit(clientIp(req));
    res.setHeader('RateLimit-Limit', String(rl.limit));
    res.setHeader('RateLimit-Remaining', String(rl.remaining));
    res.setHeader('RateLimit-Reset', String(rl.resetSeconds));
    if (!rl.allowed) {
      send(res, 429, { error: { code: 'rate_limited', message: 'Too many requests, slow down' } }, { 'Retry-After': String(rl.resetSeconds) });
      return;
    }
  }

  for (const [pattern, handle] of routes) {
    const m = pattern.exec(path);
    if (!m) continue;
    try {
      const params = m.slice(1).map((p) => decodeURIComponent(p));
      const body = handle(params, url.searchParams);
      // Data only changes daily, so let browsers and CDNs cache a bit.
      send(res, 200, body, { 'Cache-Control': 'public, max-age=600' });
    } catch (err) {
      if (err instanceof HttpError) {
        send(res, err.status, { error: { code: err.code, message: err.message } });
      } else if (err instanceof URIError) {
        send(res, 400, { error: { code: 'bad_request', message: 'Malformed URL encoding' } });
      } else {
        console.error(err);
        send(res, 500, { error: { code: 'internal_error', message: 'Something went wrong' } });
      }
    }
    return;
  }

  send(res, 404, { error: { code: 'not_found', message: `No route for ${path}. See / for docs.` } });
}
