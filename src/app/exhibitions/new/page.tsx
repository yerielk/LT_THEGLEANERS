import type { Metadata } from "next";
import { ExhibitionEditor } from "@/components/ExhibitionEditor";
import { webActor } from "@/lib/services/web-actor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New exhibition" };

export default async function NewExhibitionPage() {
  return <ExhibitionEditor mode="new" canWrite={!!(await webActor()).userId} />;
}
