import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Link } from "next-view-transitions";
import { listMine } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";
import { WorkImage } from "@/components/WorkImage";
import { EmptyState } from "@/components/States";
import { AuthButton } from "@/components/AuthButton";
import { ApiKeys } from "@/components/ApiKeys";
import { wallFor } from "@/lib/design";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My exhibitions" };

export default async function MePage() {
  const actor = await webActor();
  const mine = await listMine(actor);
  return (
    <div className="wrap" style={{ paddingBottom: 120 }}>
      <header className="page-head">
        <h1 className="display">My rooms.</h1>
        <p className="muted">
          {actor.kind === "user" ? `${actor.label}님의 전시예요.` : actor.kind === "demo" ? `${actor.label} — 로그인하지 않으면 모든 저장이 하나의 데모 사용자에게 기록돼요.` : "로그인하면 내 전시와 MCP 키를 관리할 수 있어요."}
        </p>
        {actor.kind !== "user" && <AuthButton user={null} />}
      </header>
      {mine.length === 0 ? (
        <EmptyState title="아직 만든 전시가 없어요." body="Discover에서 작품을 골라 첫 전시를 만들어 보세요. 에이전트가 MCP로 만든 초안도 여기에 나타나요." action={{ href: "/discover", label: "Choose works" }} />
      ) : (
        <div className="me-list">
          {mine.map((ex) => {
            const wall = wallFor(ex.number);
            return (
              <article key={ex.id} className="me-row" style={{ "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties}>
                <Link href={`/exhibitions/${ex.id}`} className="me-swatch" style={{ viewTransitionName: `room-${ex.id}` }} aria-label={`${ex.title}, open`}>
                  {String(ex.number).padStart(2, "0")}
                </Link>
                <div>
                  <p className="caption" style={{ margin: 0 }}>{ex.visibility === "PUBLIC" ? "Public" : "Private draft"} / {new Date(ex.createdAt).toLocaleDateString("ko-KR")} / {ex.items.length} works</p>
                  <Link href={`/exhibitions/${ex.id}`} className="h3" style={{ display: "block", margin: "6px 0 10px" }}>{ex.title}</Link>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }} aria-hidden>
                    {ex.items.slice(0, 6).map((i) => <span key={i.workId} style={{ height: 52, display: "block", aspectRatio: i.work.artwork ? `${i.work.artwork.width} / ${i.work.artwork.height}` : "2 / 3" }}><WorkImage work={i.work} /></span>)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                  <Link className="btn-ghost" href={`/exhibitions/${ex.id}/edit`}>Edit</Link>
                  <Link className="btn btn-sm" href={`/exhibitions/${ex.id}`}>View</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {actor.userId && <ApiKeys />}
    </div>
  );
}
