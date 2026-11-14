import type { Metadata } from "next";
import { TAGS } from "@/lib/recommendation/tags";
import { MEDIA, type Medium } from "@/lib/media";
import { DiscoverClient } from "./DiscoverClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Browse works" };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ medium?: string; q?: string }> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const initialMedium: Medium = MEDIA.find((medium) => medium === sp.medium) ?? "FILM";
  const tagLabels = Object.fromEntries(TAGS.map((tag) => [tag.key, tag.ko]));
  return (
    <>
      <header className="wrap page-head discover-head">
        <h1 className="display">Browse<br />what stays.</h1>
        <p className="lede" style={{ margin: 0 }}>영화와 시리즈, 책과 앨범을 한 컬렉션에서 둘러보고 마음이 가는 작품에 + 를 눌러 담으면, 그대로 나의 전시실이 됩니다.</p>
      </header>
      <DiscoverClient initial={[]} initialMedium={initialMedium} initialQ={q} tagLabels={tagLabels} mode="works" />
    </>
  );
}
