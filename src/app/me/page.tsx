import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Link } from "next-view-transitions";
import { listMine } from "@/lib/services/exhibitions";
import { webActor } from "@/lib/services/web-actor";
import { CurationWorkShelf } from "@/components/CurationWorkShelf";
import { curationDisplayTitle } from "@/components/CurationCover";
import { EmptyState } from "@/components/States";
import { AuthButton } from "@/components/AuthButton";
import { ApiKeys } from "@/components/ApiKeys";
import { coverTheme } from "@/lib/curation/cover-theme";
import { getLibrary } from "@/lib/services/library";
import { ShelfName } from "@/components/ShelfName";
import { CurationCover } from "@/components/CurationCover";
import { WorkImage } from "@/components/WorkImage";
import type { WorkView } from "@/lib/services/works";
import type { ExhibitionView } from "@/lib/services/exhibitions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My rooms" };

export default async function MePage() {
  const actor = await webActor();
  const [mine, library] = await Promise.all([listMine(actor), getLibrary(actor)]);
  return (
    <div className="wrap" style={{ paddingBottom: 120 }}>
      <header className="page-head intro-stack">
        <h1 className="display">My rooms.</h1>
        <p className="muted">
          {actor.kind === "user" ? `${actor.label}님의 큐레이션이에요.` : actor.kind === "demo" ? `${actor.label} — 로그인하지 않으면 모든 저장이 하나의 데모 사용자에게 기록돼요.` : "로그인하면 내 전시와 MCP 키를 관리할 수 있어요."}
        </p>
        {actor.kind !== "user" && <AuthButton user={null} />}
        {actor.userId && <Link className="btn-ghost" href="/welcome?next=/me">Choose your favorites again</Link>}
      </header>
      {mine.length === 0 ? (
        <EmptyState title="아직 만든 큐레이션이 없어요." body="템플릿을 고르고 작품과 감상을 담아 보세요. 에이전트가 MCP로 만든 초안도 여기에서 편집할 수 있어요." action={{ href: "/exhibitions/new", label: "Create a curation" }} />
      ) : (
        <>
        <div className="me-list">
          {mine.map((ex) => {
            const wall = coverTheme(ex.number, ex.items.map((i) => i.work));
            return (
              <article key={ex.id} className="me-row" style={{ "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties}>
                <Link href={`/exhibitions/${ex.id}`} className="me-swatch" style={{ viewTransitionName: `room-${ex.id}` }} aria-label={`${curationDisplayTitle(ex.title)}, open`}>
                  {String(ex.number).padStart(2, "0")}
                </Link>
                <div>
                  <p className="caption" style={{ margin: 0 }}><span className="nobr">{ex.visibility === "PUBLIC" ? "Public" : "Private draft"}</span> / <span className="nobr">{new Date(ex.createdAt).toLocaleDateString("ko-KR")}</span> / <span className="nobr">{ex.items.length} works</span></p>
                  <Link href={`/exhibitions/${ex.id}`} className="h3" style={{ display: "block", margin: "6px 0 10px" }}>{curationDisplayTitle(ex.title)}</Link>
                  <CurationWorkShelf items={ex.items} maxItems={4} className="me-work-shelf" ariaLabel="Works in this curation" />
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                  <Link className="btn-ghost" href={`/exhibitions/${ex.id}/edit`}>Edit</Link>
                  <Link className="btn btn-sm" href={`/exhibitions/${ex.id}`}>View</Link>
                </div>
              </article>
            );
          })}
        </div>
        <Link className="btn" href="/exhibitions/new" style={{ marginTop: 32 }}>Create a curation</Link>
        </>
      )}
      {library.shelves.map((shelf) => (shelf.works.length + shelf.curations.length > 0) && (
        <section key={shelf.id} aria-label={shelf.name}>
          <div className="shelf-head"><ShelfName id={shelf.id} name={shelf.name} /></div>
          <ShelfRow works={shelf.works} curations={shelf.curations} />
        </section>
      ))}
      {library.liked.works.length + library.liked.curations.length > 0 && (
        <section aria-label="Liked">
          <div className="shelf-head"><h2 className="h3" style={{ margin: 0 }}>Liked</h2><span className="caption">좋아요는 추천에 반영돼요</span></div>
          <ShelfRow works={library.liked.works} curations={library.liked.curations} />
        </section>
      )}
      {actor.userId && <ApiKeys />}
    </div>
  );
}

function ShelfRow({ works, curations }: { works: WorkView[]; curations: ExhibitionView[] }) {
  return (
    <div className="shelf-row">
      {curations.map((ex) => (
        <Link key={ex.id} href={`/exhibitions/${ex.id}`} className="shelf-item">
          <CurationCover number={ex.number} title={ex.title} works={ex.items} />
          <b>{curationDisplayTitle(ex.title)}</b><small>Curation / {ex.items.length} works</small>
        </Link>
      ))}
      {works.map((w) => (
        <Link key={w.id} href={`/works/${w.id}`} className="shelf-item">
          <WorkImage work={w} mini />
          <b>{w.title}</b><small>{w.creator}</small>
        </Link>
      ))}
    </div>
  );
}
