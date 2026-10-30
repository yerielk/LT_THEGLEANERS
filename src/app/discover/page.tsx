import type { Metadata } from "next";
import { searchWorks } from "@/lib/services/works";
import { TAGS } from "@/lib/recommendation/tags";
import { DiscoverClient } from "./DiscoverClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discover" };

const VALID = ["FILM", "SERIES", "BOOK", "ALBUM"] as const;
const MOOD_KEYS = ["longing", "memory", "solitude", "lingering_emotion", "dreamy", "grief", "belonging", "growing_up"];

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ medium?: string; q?: string }> }) {
  const sp = await searchParams;
  const medium = VALID.find((m) => m === sp.medium);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const { works } = searchWorks({ medium, q: q || undefined, limit: 60 });
  const tagLabels = Object.fromEntries(TAGS.map((t) => [t.key, t.ko]));
  const moods = MOOD_KEYS.map((k) => TAGS.find((t) => t.key === k)!.ko);
  return (
    <>
      <header className="wrap page-head discover-head">
        <h1 className="display">Discover<br />what stays.</h1>
        <p className="lede" style={{ margin: 0 }}>영화·시리즈·책·앨범을 한 컬렉션에서. 마음이 가는 작품에 + 를 눌러 담으면, 그대로 나의 전시실이 됩니다.</p>
      </header>
      <DiscoverClient initial={works} initialMedium={medium ?? "ALL"} initialQ={q} moods={moods} tagLabels={tagLabels} />
    </>
  );
}
