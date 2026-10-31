import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { recommend } from "@/lib/recommendation/engine";
import { webActor } from "@/lib/services/web-actor";
import type { RecommendationRequest } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** Same engine the MCP tool recommend_for_exhibition calls. */
export async function POST(req: Request) {
  try {
    rateLimit(req, "recommendations", 30);
    return ok(await recommend((await readJson(req)) as RecommendationRequest, await webActor()));
  } catch (e) {
    return fail(e);
  }
}
