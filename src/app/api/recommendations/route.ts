import { ok, fail, readJson } from "@/lib/http";
import { recommend } from "@/lib/recommendation/engine";
import { webActor } from "@/lib/services/actor";
import type { RecommendationRequest } from "@/lib/validators";

export const dynamic = "force-dynamic";

/** Same engine the MCP tool recommend_for_exhibition calls. */
export async function POST(req: Request) {
  try {
    return ok(recommend((await readJson(req)) as RecommendationRequest, webActor()));
  } catch (e) {
    return fail(e);
  }
}
