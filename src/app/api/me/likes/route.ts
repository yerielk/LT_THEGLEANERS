import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { toggleLike } from "@/lib/services/library";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

/** Toggles a like on a work or a curation. */
export async function POST(req: Request) {
  try {
    rateLimit(req, "library:write", 60);
    return ok(await toggleLike(await readJson(req), await webActor()));
  } catch (e) {
    return fail(e);
  }
}
