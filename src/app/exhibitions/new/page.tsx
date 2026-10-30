import type { Metadata } from "next";
import { ExhibitionEditor } from "@/components/ExhibitionEditor";
import { webActor } from "@/lib/services/actor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New exhibition" };

export default function NewExhibitionPage() {
  return <ExhibitionEditor mode="new" canWrite={!!webActor().userId} />;
}
