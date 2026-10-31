import { ok, fail, readJson } from "@/lib/http";
import { createExhibition, listFeatured, listMine } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const mine = new URL(req.url).searchParams.get("mine") === "1";
    const actor = await webActor();
    return ok({ exhibitions: await (mine ? listMine(actor) : listFeatured(actor)) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const { exhibition, created } = await createExhibition(await readJson(req), await webActor());
    return ok({ exhibition, created }, created ? 201 : 200);
  } catch (e) {
    return fail(e);
  }
}
