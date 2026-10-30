import Link from "next/link";
import { notFound } from "next/navigation";
import { getExhibition } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/actor";
import { LectaError } from "@/lib/services/errors";
import { FeatureArticle } from "@/components/FeatureArticle";
import { RecommendationPanel } from "@/components/RecommendationPanel";

export const dynamic = "force-dynamic";

export default async function ExhibitionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const actor = webActor();
  let ex;
  try {
    ex = getExhibition(id, actor);
  } catch (e) {
    if (e instanceof LectaError && e.code === "EXHIBITION_NOT_FOUND") notFound();
    if (e instanceof LectaError && (e.code === "UNAUTHORIZED" || e.code === "FORBIDDEN")) {
      return (
        <div className="wrap" style={{ paddingBlock: "64px 120px" }}>
          <h1 className="display">Private draft.</h1>
          <p className="lede">이 전시는 비공개 초안이라 만든 사람만 볼 수 있어요.</p>
          <Link className="btn btn-ghost" href="/discover">Go to Discover</Link>
        </div>
      );
    }
    throw e;
  }
  return (
    <>
      {saved && ex.isOwner && <div className="wrap"><p className="notice" role="status" style={{ margin: "20px 0" }}>초안을 저장했어요. 새로고침해도 그대로 남아 있어요.</p></div>}
      <FeatureArticle ex={ex} />
      <div className="wrap" style={{ paddingBottom: 96 }}>
        <RecommendationPanel exhibitionId={ex.id} canAdd={ex.isOwner} />
        {!ex.isOwner && <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>읽기 전용 전시예요. 추천 작품을 추가하려면 직접 전시를 만들어 보세요.</p>}
      </div>
    </>
  );
}
