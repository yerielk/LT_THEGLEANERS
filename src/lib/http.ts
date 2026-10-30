import { NextResponse } from "next/server";
import { asLectaError, LectaError } from "./services/errors";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function fail(e: unknown) {
  const err = asLectaError(e);
  if (!(e instanceof LectaError)) console.error("[api]", e);
  return NextResponse.json(err.toJSON(), { status: err.status, headers: { "cache-control": "no-store" } });
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
