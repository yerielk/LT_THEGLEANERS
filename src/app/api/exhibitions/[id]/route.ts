import { ok, fail, readJson } from "@/lib/http";
import { getExhibition, updateExhibition } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/actor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    return ok({ exhibition: getExhibition((await params).id, webActor()) });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    return ok({ exhibition: updateExhibition((await params).id, await readJson(req), webActor()) });
  } catch (e) {
    return fail(e);
  }
}
