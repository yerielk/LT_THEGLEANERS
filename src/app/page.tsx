import { Link } from "next-view-transitions";
import type { CSSProperties } from "react";
import { listFeatured } from "@/lib/services/exhibitions";
import { searchWorks, allWorks } from "@/lib/services/works";
import { webActor } from "@/lib/services/actor";
import { MEDIUM_PLURAL } from "@/components/WorkCover";
import { WorkImage } from "@/components/WorkImage";
import { TAGS } from "@/lib/recommendation/tags";
import { wallFor } from "@/lib/design";

export const dynamic = "force-dynamic";

const MOODS = ["longing", "memory", "solitude", "lingering_emotion", "restrained_expression", "dreamy", "grief", "belonging"];
const HANG = ["w_film_mood_for_love", "w_album_blue", "w_book_never_let_me_go", "w_film_past_lives", "w_album_pink_moon", "w_book_human_acts", "w_film_aftersun", "w_album_carrie_lowell", "w_book_kitchen", "w_film_perfect_days"];
const HANG_H: Record<string, number> = { FILM: 340, BOOK: 290, ALBUM: 220, SERIES: 180 };

export default function Home() {
  const actor = webActor();
  const featured = listFeatured(actor);
  const works = allWorks();
  const byId = new Map(works.map((w) => [w.id, w]));
  const counts = (["FILM", "SERIES", "BOOK", "ALBUM"] as const).map((m) => ({ m, n: searchWorks({ medium: m, limit: 60 }).total }));
  const moodCount = (k: string) => works.filter((w) => w.tagKeys.includes(k)).length;

  return (
    <>
      <section className="entrance">
        <div className="wrap">
          <div className="entrance-top"><span>Lecta, by THE GLEANERS</span><span>Opening exhibition, autumn 2026</span></div>
          <h1 className="mega">The things<br />we keep.</h1>
          <div className="entrance-sub">
            <p className="lede">
              영화, 시리즈, 책, 앨범. 좋아하는 작품을 고르고 왜 좋았는지 한 줄을 남기면, 그것들은 하나의 방이 됩니다.
              Lecta는 그 방을 읽고, 벽에 걸릴 다음 작품을 찾아 줍니다.
            </p>
            <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
              <Link className="btn" href="/discover">Explore the collection</Link>
              <Link className="btn-ghost" href="/exhibitions/new">Make an exhibition</Link>
            </div>
          </div>
        </div>
        <div className="hang-row" aria-label="On the wall today">
          {HANG.map((id) => byId.get(id)).filter((w) => !!w).map((w) => (
            <Link key={w!.id} href={`/works/${w!.id}`} style={{ height: HANG_H[w!.medium] }} aria-label={`${w!.title}, details`}>
              <span style={{ display: "block", height: "100%", aspectRatio: w!.artwork ? `${w!.artwork.width} / ${w!.artwork.height}` : undefined }}>
                <WorkImage work={w!} eager />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rooms wrap" aria-labelledby="rooms-title">
        <div className="rooms-head">
          <h2 id="rooms-title" className="h2">Four rooms</h2>
          <p className="muted" style={{ margin: 0, maxWidth: "30em", fontSize: 14.5 }}>THE GLEANERS가 먼저 꾸린 네 개의 방. 각 방의 벽 색은 와다 산조의 『배색 사전』에서 골랐어요.</p>
        </div>
        {featured.map((ex, i) => {
          const wall = wallFor(ex.number);
          const style = { "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties;
          return (
            <div key={ex.id} className={`room-row${i % 2 ? " flip" : ""}`} style={style}>
              <Link href={`/exhibitions/${ex.id}`} className="room-panel" style={{ viewTransitionName: `room-${ex.id}` }}>
                <span className="room-no">Room {String(ex.number).padStart(2, "0")} / {wall.name}</span>
                <span>
                  <h3 className="room-title">{ex.title}</h3>
                  <p className="room-desc">{ex.description}</p>
                </span>
                <span className="room-enter">Enter the room</span>
              </Link>
              <div className="room-wall">
                {ex.items.slice(0, 4).map((it) => (
                  <Link key={it.workId} href={`/works/${it.workId}`} aria-label={`${it.work.title}, details`} style={{ alignSelf: "center" }}>
                    <WorkImage work={it.work} />
                    <span className="label" style={{ display: "block" }}><span className="l-title" style={{ fontSize: 17 }}>{it.work.title}</span>{it.work.creator}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="moods-band wrap">
        <div className="rooms-head" style={{ marginBottom: 0 }}>
          <h2 className="h2">Browse by mood</h2>
          <div className="media-index">{counts.map(({ m, n }) => <Link key={m} href={`/discover?medium=${m}`}>{MEDIUM_PLURAL[m]}<sup>{n}</sup></Link>)}</div>
        </div>
        <p className="mood-words">
          {MOODS.map((k) => {
            const t = TAGS.find((x) => x.key === k)!;
            return <Link key={k} href={`/discover?q=${encodeURIComponent(t.ko)}`}>{t.ko}<sup>{moodCount(k)}</sup></Link>;
          })}
        </p>
      </section>

      <section className="wrap agents" id="agents">
        <div className="agents-copy">
          <h2 className="h2">Your taste, readable by the AI you choose.</h2>
          <p className="lede">
            Lecta는 이 사이트 옆에서 MCP 서버를 함께 돌려요. AI 에이전트는 카탈로그를 검색하고, 전시를 읽고, 여기서 보는 것과 같은 추천 엔진에 묻고,
            당신이 승인할 때만 비공개 초안을 저장합니다.
          </p>
          <Link className="btn-ghost" href="/agent-lab">Open the agent lab</Link>
        </div>
        <ol className="agent-steps">
          <li><span><code>search_works</code> 실제 작품을 찾아 ID를 돌려줘요.</span></li>
          <li><span><code>find_related_works</code> 작품이나 전시를 근거로 다른 매체의 작품을 추천해요.</span></li>
          <li><span><code>get_exhibition</code> 공개 전시, 또는 키가 있으면 내 초안을 읽어요.</span></li>
          <li><span><code>create_exhibition_draft</code> 승인 후 비공개 초안을 저장하고 다시 읽어 확인해요.</span></li>
        </ol>
      </section>
    </>
  );
}
