/**
 * Fixed-window rate limit kept in process memory. Enough for one server; several instances would need a
 * shared store (Redis) instead.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function hit(key: string, limit: number, windowMs = 60_000, now = Date.now()): { ok: boolean; retryAfterSeconds: number } {
  if (windows.size > 10_000) for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  let w = windows.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs };
    windows.set(key, w);
  }
  w.count++;
  return { ok: w.count <= limit, retryAfterSeconds: Math.ceil((w.resetAt - now) / 1000) };
}

/** The rightmost X-Forwarded-For entry is the one our own reverse proxy (Caddy) appended; earlier ones can be forged. */
export function clientIp(forwardedFor: string | null | undefined, fallback = "local"): string {
  const last = forwardedFor?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  return last || fallback;
}

export function resetRateLimits() {
  windows.clear();
}
