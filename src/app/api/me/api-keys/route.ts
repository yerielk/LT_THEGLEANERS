import { ok, fail, readJson, rateLimit } from "@/lib/http";
import { createApiKey, listApiKeys } from "@/lib/services/api-keys";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ keys: await listApiKeys(await webActor()) });
  } catch (e) {
    return fail(e);
  }
}

/** Issues a personal MCP key. The plaintext key is in this response only. */
export async function POST(req: Request) {
  try {
    rateLimit(req, "api-keys:create", 10);
    const body = (await readJson(req)) as { name?: unknown };
    return ok({ key: await createApiKey(await webActor(), typeof body.name === "string" ? body.name : "") }, 201);
  } catch (e) {
    return fail(e);
  }
}
