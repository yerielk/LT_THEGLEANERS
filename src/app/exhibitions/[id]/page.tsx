import { Link } from "next-view-transitions";
import { notFound } from "next/navigation";
import { getExhibition } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";
import { reactionState } from "@/lib/services/library";
import { Reactions } from "@/components/Reactions";
import { LectaError } from "@/lib/services/errors";
import { ExhibitionRoom } from "@/components/ExhibitionRoom";
import { wallFor } from "@/lib/design";
import type { CSSProperties } from "react";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { CurationReader } from "@/components/curation/CurationReader";
import { curationView } from "@/lib/curation/view";

export const dynamic = "force-dynamic";

export default async function ExhibitionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const actor = await webActor();
  let ex;
  try {
    ex = await getExhibition(id, actor);
  } catch (e) {
    if (e instanceof LectaError && e.code === "EXHIBITION_NOT_FOUND") notFound();
    if (e instanceof LectaError && (e.code === "UNAUTHORIZED" || e.code === "FORBIDDEN")) {
      return (
        <div className="wrap" style={{ paddingBlock: "64px 120px" }}>
          <h1 className="display">Private draft.</h1>
          <p className="lede">이 큐레이션은 비공개 초안이라 만든 사람만 볼 수 있어요.</p>
          <Link className="btn btn-ghost" href="/discover">작품 검색</Link>
        </div>
      );
    }
    throw e;
  }
  const reactions = await reactionState("CURATION", ex.id, actor);
  return (
    <>
      {saved && ex.isOwner && <div className="wrap"><p className="notice" role="status" style={{ margin: "12px 0" }}>초안을 저장했어요. 새로고침해도 그대로 남아 있어요.</p></div>}
      {ex.curationData ? <>
        <div className="wrap curation-reader-actions">
          {ex.isOwner ? <Link className="btn-ghost" href="/me">My rooms</Link> : <Link className="btn-ghost" href="/curations">All curations</Link>}
          <span className="caption">{ex.isOwner ? (ex.visibility === "PUBLIC" ? "Public curation" : "Private draft, only you can see this") : `Curated by ${ex.curationData.curator || ex.ownerName}`}</span>
          <span className="curation-reader-edit" style={{ display: "inline-flex", gap: 14, alignItems: "center" }}>
            {ex.visibility === "PUBLIC" && <Reactions targetType="CURATION" targetId={ex.id} initial={reactions} />}
            {ex.isOwner && <Link className="btn btn-sm" href={`/exhibitions/${ex.id}/edit`}>Edit curation</Link>}
          </span>
        </div>
        <CurationReader document={curationView(ex)} />
      </> : <>
        <ExhibitionRoom ex={ex} />
        {ex.visibility === "PUBLIC" && <div className="wrap" style={{ margin: "20px auto 0" }}><Reactions targetType="CURATION" targetId={ex.id} initial={reactions} /></div>}
      </>}
      <div className="wrap" style={{ "--room": wallFor(ex.number).hex } as CSSProperties}>
        <RecommendationPanel exhibitionId={ex.id} canAdd={ex.isOwner} />
        {!ex.isOwner && <p className="muted" style={{ fontSize: 13, margin: "-64px 0 96px" }}>다른 사람의 큐레이션이라 읽기만 할 수 있어요. 추천 작품을 담으려면 내 큐레이션을 만들어 보세요.</p>}
      </div>
    </>
  );
}
