import { fail, ok, rateLimit, readJson } from "@/lib/http";
import { curationView, saveCuration } from "@/lib/services/curation-editor";
import { getExhibition } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";

type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Context) {
  try {
    const ex = await getExhibition((await params).id, await webActor());
    return ok({ id: ex.id, version: ex.version, document: curationView(ex) });
  } catch (e) { return fail(e); }
}
export async function PATCH(req: Request, { params }: Context) {
  try {
    rateLimit(req, "curation:save", 90);
    const ex = await saveCuration((await params).id, await readJson(req, 1024 * 1024), await webActor());
    return ok({ id: ex.id, version: ex.version, document: curationView(ex) });
  } catch (e) { return fail(e); }
}
