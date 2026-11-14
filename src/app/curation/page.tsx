import type { Metadata } from "next";
import { TAGS } from "@/lib/recommendation/tags";
import { DiscoverClient } from "@/app/discover/DiscoverClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Curation" };

export default async function CurationPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const tagLabels = Object.fromEntries(TAGS.map((tag) => [tag.key, tag.ko]));
  return (
    <>
      <header className="wrap page-head discover-head">
        <h1 className="display">Curation<br />rooms.</h1>
        <p className="lede" style={{ margin: 0 }}>Explore rooms that bring works together through mood, memory and meaning.</p>
      </header>
      <DiscoverClient initial={[]} initialMedium="CURATION" initialQ={query} tagLabels={tagLabels} mode="curation" />
    </>
  );
}
