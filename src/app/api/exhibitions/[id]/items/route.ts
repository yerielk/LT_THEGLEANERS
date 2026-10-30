import { ok, fail, readJson } from "@/lib/http";
import { addItem } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/actor";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return ok({ exhibition: addItem((await params).id, await readJson(req), webActor()) }, 201);
  } catch (e) {
    return fail(e);
  }
}
