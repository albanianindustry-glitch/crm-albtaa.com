/**
 * Best-effort in-memory rate limiting, scoped per serverless
 * instance. This is a floor on top of the DB-backed per-email limit
 * in spamCheck.ts (which is the real, cross-instance-consistent
 * control) — it exists to blunt a burst from a single IP within one
 * warm instance, not to be a strict global guarantee. For a stronger
 * cross-instance guarantee, swap this for Upstash Redis (`@upstash/ratelimit`)
 * without changing the call site.
 */
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 20;

const buckets = new Map<string, { count: number; windowStart: number }>();

export async function checkPublicRateLimit(
  key: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<{ allowed: boolean }> {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  bucket.count += 1;
  if (bucket.count > maxRequests) {
    return { allowed: false };
  }
  return { allowed: true };
}
