import { ok, fail, readJson } from "@/lib/http";
import { createExhibition, listFeatured, listMine } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/actor";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  try {
    const mine = new URL(req.url).searchParams.get("mine") === "1";
    const actor = webActor();
    return ok({ exhibitions: mine ? listMine(actor) : listFeatured(actor) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const { exhibition, created } = createExhibition(await readJson(req), webActor());
    return ok({ exhibition, created }, created ? 201 : 200);
  } catch (e) {
    return fail(e);
  }
}
