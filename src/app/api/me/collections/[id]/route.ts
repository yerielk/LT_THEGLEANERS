import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { renameShelf } from "@/lib/services/library";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

/** Renames one of the person's shelves. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "library:write", 60);
    return ok(await renameShelf((await params).id, await readJson(req), await webActor()));
  } catch (e) {
    return fail(e);
  }
}
