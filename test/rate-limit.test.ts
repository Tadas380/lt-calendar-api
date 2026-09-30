import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/lib/rate-limit.ts';

test('blocks after the limit and resets after the window', () => {
  const check = createRateLimiter({ limit: 3, windowMs: 1000 });
  const t = 1_000_000;
  assert.equal(check('1.1.1.1', t).allowed, true);
  assert.equal(check('1.1.1.1', t).allowed, true);
  assert.equal(check('1.1.1.1', t).allowed, true);
  assert.equal(check('1.1.1.1', t).allowed, false);
  assert.equal(check('2.2.2.2', t).allowed, true, 'other IPs are not affected');
  assert.equal(check('1.1.1.1', t + 1001).allowed, true, 'window resets');
});
