import { notFound, redirect } from "next/navigation";
import { getExhibition } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";
import { LectaError } from "@/lib/services/errors";
import { CurationEditor } from "@/components/curation/CurationEditor";
import { curationView } from "@/lib/curation/view";

export const dynamic = "force-dynamic";

export default async function EditExhibitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await webActor();
  let ex;
  try { ex = await getExhibition(id, actor); } catch (e) { if (e instanceof LectaError && e.status < 500) notFound(); throw e; }
  if (!ex.isOwner) redirect(`/exhibitions/${id}`);
  return <CurationEditor key={ex.id} canWrite initial={curationView(ex)} id={ex.id} version={ex.version} />;
}
