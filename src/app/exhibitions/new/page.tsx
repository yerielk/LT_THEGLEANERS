import type { Metadata } from "next";
import { CurationEditor } from "@/components/curation/CurationEditor";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New curation" };

export default async function NewExhibitionPage() {
  const actor = await webActor();
  return <CurationEditor canWrite={!!actor.userId} curator={actor.label} />;
}
