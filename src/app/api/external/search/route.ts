import { ok, fail, rateLimit } from "@/lib/http";
import { searchExternal } from "@/lib/external/registry";
import { externalSearchQuerySchema } from "@/lib/services/external-works";
import { zodMessage } from "@/lib/validators";
import { LectaError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

/** Searches the external catalogs (TMDB, Kakao books, MusicBrainz, KOPIS, 서울시 문화행사). Nothing is saved. */
export async function GET(req: Request) {
  try {
    // every call spends the sources' quotas, so this is tighter than our own catalog search
    rateLimit(req, "external:search", 20);
    const sp = new URL(req.url).searchParams;
    const parsed = externalSearchQuerySchema.safeParse({ q: sp.get("q") ?? "", medium: sp.get("medium") || undefined, limit: sp.get("limit") || undefined });
    if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
    const { works, failedSources } = await searchExternal(parsed.data);
    return ok({ works, failedSources, appliedFilters: parsed.data });
  } catch (e) {
    return fail(e);
  }
}
