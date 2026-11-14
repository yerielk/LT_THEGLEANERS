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

export async function readBytes(req: Request, max = MAX_BODY): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length")) > max) throw new LectaError("VALIDATION_ERROR", "Request body too large");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new LectaError("VALIDATION_ERROR", "Request body too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

export async function readJson(req: Request, max = MAX_BODY): Promise<unknown> {
  const text = new TextDecoder().decode(await readBytes(req, max));
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new LectaError("VALIDATION_ERROR", "Body must be valid JSON");
  }
}
