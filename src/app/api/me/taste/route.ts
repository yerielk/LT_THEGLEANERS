import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { getTaste, saveTaste } from "@/lib/services/taste";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

/** The first-run taste survey: the works the user said they love, and the taste read from them. */
export async function GET() {
  try {
    return ok(await getTaste(await webActor()));
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  try {
    rateLimit(req, "taste:write", 20);
    return ok(await saveTaste(await readJson(req), await webActor()));
  } catch (e) {
    return fail(e);
  }
}
