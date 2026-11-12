import { z } from "zod";
import { ok, fail, rateLimit } from "@/lib/http";
import { searchCurations } from "@/lib/services/curations";
import { webActor } from "@/lib/services/web-actor";
import { LectaError } from "@/lib/services/errors";
import { zodMessage } from "@/lib/validators";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(48),
});

/** Curation search: public exhibitions matching a keyword. */
export async function GET(req: Request) {
  try {
    rateLimit(req, "curations", 60);
    const sp = new URL(req.url).searchParams;
    const parsed = querySchema.safeParse({ q: sp.get("q") || undefined, limit: sp.get("limit") || undefined });
    if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
    return ok(await searchCurations(parsed.data, await webActor()));
  } catch (e) {
    return fail(e);
  }
}
