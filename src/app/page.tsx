import Link from "next/link";
import { listFeatured } from "@/lib/services/exhibitions";
import { searchWorks } from "@/lib/services/works";
import { webActor } from "@/lib/services/actor";
import { WorkCover, MEDIUM_PLURAL } from "@/components/WorkCover";
import type { ExhibitionView } from "@/lib/services/exhibitions";

export const dynamic = "force-dynamic";

function ExStrip({ ex, count = 4 }: { ex: ExhibitionView; count?: number }) {
  return (
    <div className="ex-strip" style={{ gridTemplateColumns: `repeat(${count}, minmax(0,1fr))` }}>
      {ex.items.slice(0, count).map((i) => <WorkCover key={i.workId} work={i.work} showCreator={false} />)}
    </div>
  );
}

export default function Home() {
  const actor = webActor();
  const featured = listFeatured(actor);
  const [lead, ...rest] = featured;
  const counts = (["FILM", "SERIES", "BOOK", "ALBUM"] as const).map((m) => ({ m, n: searchWorks({ medium: m, limit: 60 }).total }));
  const heroWorks = ["w_film_mood_for_love", "w_album_blue", "w_book_remains_of_day", "w_album_pink_moon"]
    .map((id) => featured.flatMap((e) => e.items).find((i) => i.workId === id)?.work)
    .filter((w): w is NonNullable<typeof w> => !!w);
  const filmFeature = searchWorks({ medium: "FILM", q: "aftersun" }).works[0];
  const bookFeature = searchWorks({ medium: "BOOK", q: "stoner" }).works[0];

  return (
    <>
      <div className="wrap">
        <div className="masthead caption"><span>Vol. 001 / Your cultural universe</span><span>The Gleaners / 2026</span></div>
        <hr className="rule-ink" />
        <section className="grid12 hero">
          <div className="hero-copy">
            <h1 className="display">The things<br />we keep.</h1>
            <p className="lede">영화, 시리즈, 책, 앨범. 좋아하는 작품을 고르고, 왜 좋았는지 한 줄을 남기고, 나만의 전시로 엮어 보세요. Lecta는 그 전시를 읽고 그 옆에 놓일 다음 작품을 찾아 줍니다.</p>
            <div className="hero-actions">
              <Link className="btn" href="/discover">Explore the archive</Link>
              <Link className="btn btn-ghost" href="/exhibitions/new">Make an exhibition</Link>
            </div>
          </div>
          <div className="hero-collage" aria-label="Works from the featured exhibitions">
            {heroWorks.map((w) => <Link key={w.id} href={`/works/${w.id}`}><WorkCover work={w} /></Link>)}
          </div>
        </section>
      </div>

      {lead && (
        <section className="section" style={{ background: "var(--paper-strong)" }}>
          <div className="wrap">
            <div className="section-head">
              <h2 className="h2" style={{ margin: 0 }}>Featured exhibitions</h2>
              <span className="caption">Editorial samples by The Gleaners</span>
            </div>
            <div className="grid12" style={{ rowGap: 32 }}>
              <Link href={`/exhibitions/${lead.id}`} className="feature-lead ex-card"><ExStrip ex={lead} /></Link>
              <div className="feature-side">
                <p className="caption">Exhibition no. {String(lead.number).padStart(3, "0")} · {lead.items.length} works</p>
                <h3 className="h2" style={{ margin: "12px 0 16px" }}><Link href={`/exhibitions/${lead.id}`}>{lead.title}</Link></h3>
                <p className="muted">{lead.description}</p>
                <Link className="linkish" href={`/exhibitions/${lead.id}`}>Visit the exhibition</Link>
              </div>
            </div>
            <div className="grid12 feature-row">
              {rest.slice(0, 3).map((ex, i) => (
                <Link key={ex.id} href={`/exhibitions/${ex.id}`} className="ex-card">
                  <ExStrip ex={ex} count={i === 1 ? 3 : 2} />
                  <h3 className="h3">{ex.title}</h3>
                  <p className="caption">No. {String(ex.number).padStart(3, "0")} · {ex.items.length} works</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section wrap">
        <div className="section-head">
          <h2 className="h2" style={{ margin: 0 }}>Discover by medium</h2>
          <Link className="linkish" href="/discover">See all works</Link>
        </div>
        <div className="grid12 medium-index">
          {filmFeature && <Link href={`/works/${filmFeature.id}`} className="mi-big"><WorkCover work={filmFeature} /></Link>}
          {bookFeature && <Link href={`/works/${bookFeature.id}`} className="mi-small" style={{ marginTop: 96 }}><WorkCover work={bookFeature} /></Link>}
          <div className="mi-list">
            <p className="caption" style={{ marginTop: 0 }}>Index</p>
            {counts.map(({ m, n }) => (
              <Link key={m} href={`/discover?medium=${m}`}><span>{MEDIUM_PLURAL[m]}</span><span>{n}</span></Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section agents-band" id="agents">
        <div className="wrap grid12" style={{ rowGap: 32 }}>
          <div style={{ gridColumn: "1 / span 5" }}>
            <p className="caption">How agents use Lecta</p>
            <h2 className="h2" style={{ marginTop: 12 }}>Your taste, readable by the AI you choose.</h2>
            <p style={{ color: "#cfc8bb", maxWidth: "32em" }}>
              Lecta runs a Model Context Protocol server next to this site. An AI agent can search the catalog, read an exhibition,
              ask the same recommendation engine you see here, and — only with your approval — save a private draft.
            </p>
          </div>
          <ol className="agent-steps">
            <li><span><code>search_works</code> finds real works and returns their IDs.</span></li>
            <li><span><code>get_exhibition</code> reads public exhibitions, or your own drafts with your key.</span></li>
            <li><span><code>recommend_for_exhibition</code> explains why a work belongs, from your exhibition.</span></li>
            <li><span><code>create_exhibition_draft</code> saves a private draft after you approve it, then the agent reads it back.</span></li>
          </ol>
        </div>
      </section>
    </>
  );
}
