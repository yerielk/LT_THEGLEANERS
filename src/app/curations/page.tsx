import type { Metadata } from "next";
import { Link } from "next-view-transitions";
import { searchCurations } from "@/lib/services/curations";
import { webActor } from "@/lib/services/web-actor";
import { SearchTabs } from "@/components/SearchTabs";
import { CurationsClient } from "./CurationsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "큐레이션 검색" };

export default async function CurationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const { curations } = await searchCurations({ q: q || undefined }, await webActor());
  return (
    <>
      <header className="wrap page-head discover-head">
        <div>
          <SearchTabs active="curations" />
          <h1 className="display">Rooms<br />others keep.</h1>
        </div>
        <div style={{ display: "grid", gap: 16, justifyItems: "start" }}>
          <p className="lede" style={{ margin: 0 }}>다른 사람이 엮은 큐레이션을 제목, 담긴 작품, 창작자, 분위기로 찾아보세요. 마음에 드는 방에 들어가 작품을 담아 올 수 있어요.</p>
          <Link className="btn-ghost" href="/exhibitions/new">새 큐레이션 만들기</Link>
        </div>
      </header>
      <CurationsClient initial={curations} initialQ={q} />
    </>
  );
}
