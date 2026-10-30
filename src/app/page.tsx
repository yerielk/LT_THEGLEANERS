import Link from "next/link";
import { listFeatured } from "@/lib/services/exhibitions";
import { searchWorks, allWorks } from "@/lib/services/works";
import { webActor } from "@/lib/services/actor";
import { WorkCover, MEDIUM_PLURAL } from "@/components/WorkCover";
import { TAGS } from "@/lib/recommendation/tags";

export const dynamic = "force-dynamic";

const MOODS = ["longing", "memory", "solitude", "lingering_emotion", "restrained_expression", "dreamy", "grief", "belonging"];

export default function Home() {
  const actor = webActor();
  const featured = listFeatured(actor);
  const lead = featured[0];
  const works = allWorks();
  const byId = new Map(works.map((w) => [w.id, w]));
  const hero = { main: byId.get("w_film_mood_for_love"), a: byId.get("w_album_blue"), b: byId.get("w_book_remains_of_day") };
  const counts = (["FILM", "SERIES", "BOOK", "ALBUM"] as const).map((m) => ({ m, n: searchWorks({ medium: m, limit: 60 }).total }));
  const moodCount = (k: string) => works.filter((w) => w.tagKeys.includes(k)).length;
  const quote = lead?.items.find((i) => i.curatorNote);

  return (
    <>
      {/* ── Issue cover ── */}
      <section className="issue">
        <div className="wrap issue-grid">
          <div className="issue-copy">
            <p className="issue-line"><span>Issue 001</span><span>Autumn 2026</span></p>
            <h1 className="mega">The things<br />we keep.</h1>
            <p className="issue-lede">
              영화, 시리즈, 책, 앨범. 좋아하는 작품을 고르고, 왜 좋았는지 한 줄을 남기고, 나만의 전시로 엮어 보세요.
              Lecta는 그 전시를 읽고, 그 옆에 놓일 다음 작품을 찾아 줍니다.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-light" href="/discover">Explore the archive</Link>
              <Link className="btn btn-outline-light" href="/exhibitions/new">Make an exhibition</Link>
            </div>
          </div>
          <div className="issue-collage" aria-label="Works from this issue">
            {hero.main && <Link href={`/works/${hero.main.id}`} className="ic-main"><WorkCover work={hero.main} /></Link>}
            {hero.a && <Link href={`/works/${hero.a.id}`} className="ic-a"><WorkCover work={hero.a} /></Link>}
            {hero.b && <Link href={`/works/${hero.b.id}`} className="ic-b"><WorkCover work={hero.b} /></Link>}
            <p className="ic-note">“말하지 않아서 오래 남는 것들.”</p>
          </div>
        </div>
      </section>

      {/* ── Contents ── */}
      <section className="wrap contents">
        <div className="contents-head">
          <h2 className="h2">In this issue</h2>
          <p className="muted">THE GLEANERS가 먼저 꾸려 본 네 개의 전시. 작품을 눌러 들어가거나, 같은 방식으로 나만의 전시를 만들어 보세요.</p>
        </div>
        <ol className="contents-list">
          {featured.map((ex) => (
            <li key={ex.id}>
              <Link href={`/exhibitions/${ex.id}`}>
                <span className="cl-no">{String(ex.number).padStart(2, "0")}</span>
                <span className="cl-title">{ex.title}</span>
                <span className="cl-desc">{ex.description}</span>
                <span className="cl-thumbs" aria-hidden>{ex.items.slice(0, 4).map((i) => <WorkCover key={i.workId} work={i.work} mini />)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Feature spread ── */}
      {lead && (
        <section className="feature">
          <div className="wrap">
            <p className="kicker">Feature / Exhibition no. {String(lead.number).padStart(3, "0")}</p>
            <h2 className="feature-title"><Link href={`/exhibitions/${lead.id}`}>{lead.title}</Link></h2>
            <div className="feature-grid">
              {lead.items.slice(0, 4).map((i, idx) => (
                <Link key={i.workId} href={`/works/${i.workId}`} className={`fg fg-${idx}`}>
                  <WorkCover work={i.work} />
                  <span className="fg-cap"><b>{i.work.title}</b> {i.work.creator}</span>
                </Link>
              ))}
              {quote && (
                <blockquote className="fg-quote">
                  <p>“{quote.curatorNote}”</p>
                  <cite>on {quote.work.title}</cite>
                </blockquote>
              )}
            </div>
            <p style={{ marginTop: 40 }}><Link className="btn" href={`/exhibitions/${lead.id}`}>Read the exhibition</Link></p>
          </div>
        </section>
      )}

      {/* ── Moods & media ── */}
      <section className="wrap moods">
        <div className="moods-head">
          <h2 className="h2">Browse by mood</h2>
          <div className="media-index">
            {counts.map(({ m, n }) => <Link key={m} href={`/discover?medium=${m}`}>{MEDIUM_PLURAL[m]} <sup>{n}</sup></Link>)}
          </div>
        </div>
        <p className="mood-cloud">
          {MOODS.map((k) => {
            const t = TAGS.find((x) => x.key === k)!;
            return (
              <Link key={k} href={`/discover?q=${encodeURIComponent(t.ko)}`}>
                {t.ko}<sup>{moodCount(k)}</sup>
              </Link>
            );
          })}
        </p>
      </section>

      {/* ── Agents ── */}
      <section className="section agents-band" id="agents">
        <div className="wrap grid12" style={{ rowGap: 32 }}>
          <div style={{ gridColumn: "1 / span 5" }}>
            <h2 className="h2" style={{ marginTop: 0 }}>Your taste, readable by the AI you choose.</h2>
            <p style={{ color: "#cfc8bb", maxWidth: "32em" }}>
              Lecta는 이 사이트 옆에서 MCP 서버를 함께 돌려요. AI 에이전트는 카탈로그를 검색하고, 전시를 읽고, 여기서 보는 것과 같은 추천 엔진에 묻고,
              당신이 승인할 때만 비공개 초안을 저장합니다.
            </p>
            <Link className="linkish" href="/agent-lab" style={{ color: "#f4f0e7" }}>Open the agent lab</Link>
          </div>
          <ol className="agent-steps">
            <li><span><code>search_works</code> 실제 작품을 찾아 ID를 돌려줘요.</span></li>
            <li><span><code>get_exhibition</code> 공개 전시, 또는 키가 있으면 내 초안을 읽어요.</span></li>
            <li><span><code>recommend_for_exhibition</code> 전시에 왜 어울리는지 근거와 함께 추천해요.</span></li>
            <li><span><code>create_exhibition_draft</code> 승인 후 비공개 초안을 저장하고, 다시 읽어 확인해요.</span></li>
          </ol>
        </div>
      </section>
    </>
  );
}
