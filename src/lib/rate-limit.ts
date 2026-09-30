/**
 * Small in-memory fixed-window rate limiter (per client IP).
 * Good enough for a single instance; use Redis or similar if you scale out.
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export function createRateLimiter({ limit = 120, windowMs = 60_000 } = {}) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Clean up old entries so memory does not grow forever.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
  }, windowMs);
  sweep.unref();

  return function check(ip: string, now = Date.now()): RateLimitResult {
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count++;
    return {
      allowed: entry.count <= limit,
      limit,
      remaining: Math.max(0, limit - entry.count),
      resetSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  };
}
