import { ok, fail, rateLimit } from "@/lib/http";
import { webActor } from "@/lib/services/web-actor";
import { recommendCurations } from "@/lib/recommendation/curations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    rateLimit(req, "curation-recommendations", 40);
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.slice(0, 80) ?? "";
    const workIds = sp.getAll("workId").slice(0, 8).filter((id) => /^[A-Za-z0-9_-]{3,64}$/.test(id));
    if (!q.trim() || !workIds.length) return ok({ recommendations: [], embeddingAvailable: false });
    const { recommendations, embeddingAvailable } = await recommendCurations({ q, workIds }, await webActor());
    return ok({ recommendations, embeddingAvailable });
  } catch (e) { return fail(e); }
}
