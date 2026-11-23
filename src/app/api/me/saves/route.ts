import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { toggleSave } from "@/lib/services/library";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

/** Saves a work or a curation to the default shelf, or takes it off. */
export async function POST(req: Request) {
  try {
    rateLimit(req, "library:write", 60);
    return ok(await toggleSave(await readJson(req), await webActor()));
  } catch (e) {
    return fail(e);
  }
}
