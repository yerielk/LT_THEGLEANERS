import type { Metadata } from "next";
import { TAGS } from "@/lib/recommendation/tags";
import { SearchTabs } from "@/components/SearchTabs";
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
        <div><SearchTabs active="curations" query={query} /><h1 className="display">Curation<br />rooms.</h1></div>
        <p className="lede" style={{ margin: 0 }}>다른 사람이 엮은 방을 둘러보세요. 영화, 책, 음악이 한 가지 마음으로 묶여 있어요.</p>
      </header>
      <DiscoverClient initial={[]} initialMedium="CURATION" initialQ={query} tagLabels={tagLabels} mode="curation" />
    </>
  );
}
