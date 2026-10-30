import { ok, fail } from "@/lib/http";
import { getWork } from "@/lib/services/works";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return ok({ work: getWork((await params).id) });
  } catch (e) {
    return fail(e);
  }
}
