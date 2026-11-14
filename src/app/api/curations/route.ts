import { fail, ok, rateLimit, readJson } from "@/lib/http";
import { createCuration, curationView } from "@/lib/services/curation-editor";
import { webActor } from "@/lib/services/web-actor";

export async function POST(req: Request) {
  try {
    rateLimit(req, "curation:create", 20);
    const actor = await webActor();
    const ex = await createCuration(await readJson(req, 1024 * 1024), actor);
    return ok({ id: ex.id, version: ex.version, document: curationView(ex) }, 201);
  } catch (e) { return fail(e); }
}
