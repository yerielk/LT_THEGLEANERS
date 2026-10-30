import type { Metadata } from "next";
import { searchWorks } from "@/lib/services/works";
import { TAGS } from "@/lib/recommendation/tags";
import { DiscoverClient } from "./DiscoverClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discover" };

const VALID = ["FILM", "SERIES", "BOOK", "ALBUM"] as const;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ medium?: string }> }) {
  const sp = await searchParams;
  const medium = VALID.find((m) => m === sp.medium);
  const { works } = searchWorks({ medium, limit: 60 });
  const tagLabels = Object.fromEntries(TAGS.map((t) => [t.key, t.ko]));
  return (
    <>
      <header className="wrap page-head grid12" style={{ rowGap: 16 }}>
        <h1 className="display" style={{ gridColumn: "1 / span 8", margin: 0 }}>Discover what stays.</h1>
        <p className="lede" style={{ gridColumn: "9 / span 4", alignSelf: "end", margin: 0 }}>
          영화·시리즈·책·앨범을 한 아카이브에서. 마음이 가는 작품을 골라 선반에 담으면, 그대로 전시가 됩니다.
        </p>
      </header>
      <DiscoverClient initial={works} initialMedium={medium ?? "ALL"} tagLabels={tagLabels} />
    </>
  );
}
