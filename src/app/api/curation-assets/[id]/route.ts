import { fail } from "@/lib/http";
import { readCurationImage } from "@/lib/services/curation-editor";
import { webActor } from "@/lib/services/web-actor";

export const runtime = "nodejs";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { bytes, mime } = await readCurationImage((await params).id, await webActor());
    return new Response(new Uint8Array(bytes), { headers: { "content-type": mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (e) { return fail(e); }
}
