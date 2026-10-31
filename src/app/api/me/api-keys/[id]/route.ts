import { ok, fail } from "@/lib/http";
import { revokeApiKey } from "@/lib/services/api-keys";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await revokeApiKey(await webActor(), (await params).id);
    return ok({ revoked: true });
  } catch (e) {
    return fail(e);
  }
}
