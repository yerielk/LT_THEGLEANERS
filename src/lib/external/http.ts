import { LectaError } from "../services/errors";

export type Fetch = typeof fetch;

/** GETs a source and maps its failures onto our error codes. null on 404. Never puts the URL in a message: it may carry a key. */
export async function getOrNull(name: string, url: string, init: RequestInit = {}, f: Fetch = fetch): Promise<Response | null> {
  let res: Response;
  try {
    res = await f(url, { ...init, signal: init.signal ?? AbortSignal.timeout(8000) });
  } catch {
    throw new LectaError("SERVICE_UNAVAILABLE", `${name} did not answer`);
  }
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) throw new LectaError("SERVICE_UNAVAILABLE", `${name} rejected our key`, false);
  if (res.status === 429) throw new LectaError("RATE_LIMITED", `${name} is rate limiting us`);
  if (!res.ok) throw new LectaError("SERVICE_UNAVAILABLE", `${name} answered ${res.status}`);
  return res;
}

export function requireKey(name: string, key: string | undefined): string {
  const k = key?.trim();
  if (!k) throw new LectaError("SERVICE_UNAVAILABLE", `${name} is not configured`, false);
  return k;
}

export const clampLimit = (limit: number | undefined, max: number) => Math.min(Math.max(limit ?? 10, 1), max);
