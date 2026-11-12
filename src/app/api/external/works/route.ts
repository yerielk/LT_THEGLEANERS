import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { saveExternalWork } from "@/lib/services/external-works";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

/** Saves one external work into our catalog: body { source, externalId, medium, title? }. */
export async function POST(req: Request) {
  try {
    rateLimit(req, "external:save", 20);
    const { work, created } = await saveExternalWork(await readJson(req), await webActor());
    return ok({ work, created }, created ? 201 : 200);
  } catch (e) {
    return fail(e);
  }
}
