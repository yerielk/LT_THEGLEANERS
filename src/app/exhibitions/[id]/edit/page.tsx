import { notFound, redirect } from "next/navigation";
import { getExhibition } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";
import { LectaError } from "@/lib/services/errors";
import { ExhibitionEditor } from "@/components/ExhibitionEditor";

export const dynamic = "force-dynamic";

export default async function EditExhibitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await webActor();
  let ex;
  try { ex = await getExhibition(id, actor); } catch (e) { if (e instanceof LectaError && e.status < 500) notFound(); throw e; }
  if (!ex.isOwner) redirect(`/exhibitions/${id}`);
  return (
    <ExhibitionEditor mode="edit" canWrite init={{
      id: ex.id, number: ex.number, version: ex.version, title: ex.title, description: ex.description ?? "",
      items: ex.items.map((i) => ({ id: i.workId, title: i.work.title, originalTitle: i.work.originalTitle, creator: i.work.creator, medium: i.work.medium, releaseYear: i.work.releaseYear, coverTone: i.work.coverTone, artwork: i.work.artwork, note: i.curatorNote ?? "" })),
    }} />
  );
}
