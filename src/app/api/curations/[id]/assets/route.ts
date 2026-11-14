import { fail, ok, rateLimit, readBytes } from "@/lib/http";
import { uploadCurationImage } from "@/lib/services/curation-editor";
import { webActor } from "@/lib/services/web-actor";
import { getExhibition } from "@/lib/services/exhibitions";
import { LectaError } from "@/lib/services/errors";

export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req, "curation:upload", 30);
    const actor = await webActor(), { id } = await params;
    const ex = await getExhibition(id, actor);
    if (!ex.isOwner) throw new LectaError("FORBIDDEN", "만든 사람만 이미지를 올릴 수 있어요.");
    return ok(await uploadCurationImage(id, await readBytes(req, 8 * 1024 * 1024), actor), 201);
  } catch (e) { return fail(e); }
}
