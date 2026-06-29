// Lightweight fixed-window limiter. Per serverless instance, so it is a
// best-effort guard, not a global quota. For production scale, back it with a
// shared store (e.g. Upstash). Documented as a known limitation.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "local";
  return `${scope}:${fwd.split(",")[0].trim()}`;
}
