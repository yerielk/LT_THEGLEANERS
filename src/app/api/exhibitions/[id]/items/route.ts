import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { addItem } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "exhibitions:write", 20);
    return ok({ exhibition: await addItem((await params).id, await readJson(req), await webActor()) }, 201);
  } catch (e) {
    return fail(e);
  }
}
