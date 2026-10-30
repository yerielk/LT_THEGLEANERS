import type { Metadata } from "next";
import Link from "next/link";
import { listMine } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/actor";
import { WorkCover } from "@/components/WorkCover";
import { EmptyState } from "@/components/States";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My exhibitions" };

export default function MePage() {
  const actor = webActor();
  const mine = listMine(actor);
  return (
    <div className="wrap" style={{ paddingBottom: 96 }}>
      <header className="page-head">
        <h1 className="display" style={{ margin: 0 }}>My exhibitions.</h1>
        <p className="muted">{actor.userId ? `${actor.label} — 이 데모 환경의 모든 저장은 하나의 데모 사용자에게 기록돼요.` : "읽기 전용 환경이에요 (DEMO_MODE가 꺼져 있음)."}</p>
      </header>
      {mine.length === 0 ? (
        <EmptyState title="아직 만든 전시가 없어요." body="Discover에서 작품을 골라 첫 전시를 만들어 보세요. 에이전트가 MCP로 만든 초안도 여기에 나타나요." action={{ href: "/discover", label: "Choose works" }} />
      ) : (
        <div className="me-list">
          {mine.map((ex) => (
            <article key={ex.id} className="me-row">
              <div className="thumbs" aria-hidden>{ex.items.slice(0, 3).map((i) => <WorkCover key={i.workId} work={i.work} mini />)}</div>
              <div>
                <p className="caption" style={{ margin: 0 }}>No. {String(ex.number).padStart(3, "0")} / {ex.visibility === "PUBLIC" ? "Public" : "Private draft"} / {new Date(ex.createdAt).toLocaleDateString("ko-KR")}</p>
                <Link href={`/exhibitions/${ex.id}`} className="h3" style={{ display: "block", margin: "6px 0" }}>{ex.title}</Link>
                <span className="muted" style={{ fontSize: 13.5 }}>{ex.items.length} works</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link className="btn btn-sm btn-ghost" href={`/exhibitions/${ex.id}/edit`}>Edit</Link>
                <Link className="btn btn-sm" href={`/exhibitions/${ex.id}`}>View</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
