import { ok, fail } from "@/lib/http";
import { webActor } from "@/lib/services/web-actor";
import { getCurationDiscovery } from "@/lib/services/curation-discovery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getCurationDiscovery(await webActor()));
  } catch (error) {
    return fail(error);
  }
}
