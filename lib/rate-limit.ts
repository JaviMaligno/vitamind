/**
 * Minimal in-memory fixed-window rate limiter for the OAuth endpoints.
 *
 * Scope is per serverless instance (state dies on cold start and isn't shared
 * across concurrent lambdas), so this is burst protection against a single
 * hammering source — the realistic abuse mode for a small public API — not a
 * distributed quota. If real traffic ever outgrows it, swap the Map for a
 * shared store behind the same two functions.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 10_000;

/** True when the call is allowed; false when the window's limit is exhausted. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Opportunistic pruning so an attacker rotating keys can't grow the map forever.
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
    // Still oversized after pruning live windows: drop everything (fail open).
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Test hook. */
export function resetRateLimiter(): void {
  buckets.clear();
}
