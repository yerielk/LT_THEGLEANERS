import { NextResponse } from "next/server";
import { asLectaError, LectaError } from "./services/errors";
import { clientIp, hit } from "./rate-limit";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function fail(e: unknown) {
  const err = asLectaError(e);
  if (!(e instanceof LectaError)) console.error("[api]", e);
  const retry = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  return NextResponse.json(err.toJSON(), { status: err.status, headers: { "cache-control": "no-store", ...(retry ? { "retry-after": String(retry) } : {}) } });
}

/** Per-IP limit for one route; throws RATE_LIMITED (429) when exceeded. */
export function rateLimit(req: Request, route: string, perMinute: number) {
  const r = hit(`${route}:${clientIp(req.headers.get("x-forwarded-for"))}`, perMinute);
  if (!r.ok) throw new LectaError("RATE_LIMITED", "Too many requests. Try again shortly.", true, { retryAfterSeconds: r.retryAfterSeconds });
}

const MAX_BODY = 32 * 1024;

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new LectaError("VALIDATION_ERROR", "Request body too large");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new LectaError("VALIDATION_ERROR", "Body must be valid JSON");
  }
}
