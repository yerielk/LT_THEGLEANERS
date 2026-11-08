import { ok, fail, rateLimit } from "@/lib/http";
import { searchWorks } from "@/lib/services/works";
import { worksQuerySchema, zodMessage } from "@/lib/validators";
import { LectaError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    rateLimit(req, "works", 60);
    const sp = new URL(req.url).searchParams;
    const parsed = worksQuerySchema.safeParse({ q: sp.get("q") || undefined, medium: sp.get("medium") || undefined, limit: sp.get("limit") || undefined });
    if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
    const { works, total } = await searchWorks(parsed.data);
    return ok({ works, total, appliedFilters: parsed.data });
  } catch (e) {
    return fail(e);
  }
}
