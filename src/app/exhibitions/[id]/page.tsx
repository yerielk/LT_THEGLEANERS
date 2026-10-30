import Link from "next/link";
import { notFound } from "next/navigation";
import { getExhibition } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/actor";
import { LectaError } from "@/lib/services/errors";
import { ExhibitionSpread } from "@/components/ExhibitionSpread";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { CopyLink } from "@/components/CopyLink";

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
  const no = String(ex.number).padStart(3, "0");
  return (
    <div className="wrap" style={{ paddingBottom: 96 }}>
      {saved && ex.isOwner && <p className="notice" role="status" style={{ marginTop: 24 }}>초안을 저장했어요. 새로고침해도 그대로 남아 있어요.</p>}
      <header className="grid12 spread-hero">
        <div className="sh-title">
          <p className="caption">Exhibition no. {no}{ex.isEditorial ? " / Editorial sample" : ""}</p>
          <h1 className="display" style={{ margin: "12px 0 20px", overflowWrap: "anywhere" }}>{ex.title}</h1>
          {ex.description && <p className="lede" style={{ margin: 0 }}>{ex.description}</p>}
        </div>
        <div className="sh-meta" style={{ display: "grid", gap: 10, fontSize: 14 }}>
          <span><b>{ex.items.length}</b> works</span>
          <span className="muted">Curated by {ex.ownerName}</span>
          <span><span className={`badge ${ex.visibility === "PUBLIC" ? "badge-olive" : "badge-rust"}`}>{ex.visibility === "PUBLIC" ? "Public" : "Private draft"}</span></span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <CopyLink isDraft={ex.visibility !== "PUBLIC"} />
            {ex.isOwner && <Link className="btn btn-sm btn-ghost" href={`/exhibitions/${ex.id}/edit`}>Edit</Link>}
          </div>
        </div>
      </header>
      <hr className="rule-ink" style={{ marginBottom: 56 }} />
      <ExhibitionSpread items={ex.items} />
      <RecommendationPanel exhibitionId={ex.id} canAdd={ex.isOwner} />
      {!ex.isOwner && <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>읽기 전용 전시예요. 추천 작품을 추가하려면 직접 전시를 만들어 보세요.</p>}
    </div>
  );
}
