import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handler } from '../src/app.ts';

let server: Server;
let base: string;

before(async () => {
  server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const get = (path: string) => fetch(base + path);

test('GET /health', async () => {
  const res = await get('/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('GET / serves the docs page', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/html/);
});

test('GET /api/v1/today has the expected shape', async () => {
  const body = await (await get('/api/v1/today')).json();
  assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(body.namedays));
  assert.equal(typeof body.isDayOff, 'boolean');
});

test('GET /api/v1/days/:date', async () => {
  const body = await (await get('/api/v1/days/2026-12-24')).json();
  assert.equal(body.holiday.id, 'christmas-eve');
  assert.ok(body.namedays.includes('Ieva'));
  assert.equal(body.weekday.en, 'Thursday');
});

test('GET /api/v1/namedays/name/:name with diacritics in URL', async () => {
  const res = await get('/api/v1/namedays/name/' + encodeURIComponent('Žygimantas'));
  assert.equal(res.status, 200);
  assert.ok((await res.json()).dates.includes('03-20'));
});

test('GET /api/v1/namedays/:date accepts MM-DD and YYYY-MM-DD', async () => {
  const a = await (await get('/api/v1/namedays/03-04')).json();
  const b = await (await get('/api/v1/namedays/2027-03-04')).json();
  assert.deepEqual(a, b);
});

test('GET /api/v1/namedays?month=02 filters by month', async () => {
  const body = await (await get('/api/v1/namedays?month=02')).json();
  assert.equal(Object.keys(body).length, 28);
});

test('GET /api/v1/holidays/:year', async () => {
  const body = await (await get('/api/v1/holidays/2026')).json();
  assert.equal(body.holidays.length, 16);
});

test('GET /api/v1/calendar/:year/:month', async () => {
  const body = await (await get('/api/v1/calendar/2028/02')).json();
  assert.equal(body.days.length, 29); // leap year
});

test('GET /api/v1/working-days', async () => {
  const body = await (await get('/api/v1/working-days?from=2026-12-01&to=2026-12-31')).json();
  assert.equal(body.workingDays, 21);
});

test('validation errors return 400 with a message', async () => {
  for (const path of [
    '/api/v1/days/2026-02-30',
    '/api/v1/days/hello',
    '/api/v1/holidays/1999',
    '/api/v1/namedays/13-01',
    '/api/v1/namedays/search?q=a',
    '/api/v1/working-days?from=2026-12-31&to=2026-12-01',
    '/api/v1/namedays/name/%E0%A4%A',
  ]) {
    const res = await get(path);
    assert.equal(res.status, 400, path);
    assert.ok((await res.json()).error.message, path);
  }
});

test('unknown name returns 404', async () => {
  assert.equal((await get('/api/v1/namedays/name/Xyzabc')).status, 404);
});

test('unknown route returns 404', async () => {
  assert.equal((await get('/api/v1/nope')).status, 404);
});

test('POST is rejected', async () => {
  const res = await fetch(base + '/api/v1/today', { method: 'POST' });
  assert.equal(res.status, 405);
});

test('CORS and security headers are set', async () => {
  const res = await get('/api/v1/today');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('ratelimit-limit'));
});
