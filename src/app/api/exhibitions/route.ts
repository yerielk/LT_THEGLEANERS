import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { createExhibition, listFeatured, listMine, searchVisibleExhibitions } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const mine = params.get("mine") === "1";
    const actor = await webActor();
    const query = params.get("q")?.slice(0, 80).trim();
    if (query) return ok({ exhibitions: await searchVisibleExhibitions(query, actor) });
    return ok({ exhibitions: await (mine ? listMine(actor) : listFeatured(actor)) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    rateLimit(req, "exhibitions:write", 20);
    const { exhibition, created } = await createExhibition(await readJson(req), await webActor());
    return ok({ exhibition, created }, created ? 201 : 200);
  } catch (e) {
    return fail(e);
  }
}
