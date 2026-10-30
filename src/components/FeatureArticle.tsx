import Link from "next/link";
import type { ExhibitionView } from "@/lib/services/exhibitions";
import { WorkCover, MEDIUM_KO } from "./WorkCover";
import { CopyLink } from "./CopyLink";

/**
 * Exhibition detail as a magazine feature (editorial-01): a full-bleed opener in the first work's tone,
 * then the works as alternating plates, with the strongest curator note pulled out as a quote.
 */
export function FeatureArticle({ ex }: { ex: ExhibitionView }) {
  const no = String(ex.number).padStart(3, "0");
  const first = ex.items[0];
  const pulled = [...ex.items].filter((i) => i.curatorNote).sort((a, b) => (b.curatorNote!.length - a.curatorNote!.length))[0];
  const date = new Date(ex.updatedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <article>
      <header className={`opener tone-${first?.work.coverTone ?? "night"}`}>
        <div className="wrap opener-grid">
          <div className="opener-copy">
            <p className="kicker">
              Exhibition no. {no} <span className="sep">/</span> {ex.isEditorial ? "Editorial sample" : ex.visibility === "PUBLIC" ? "Public" : "Private draft"}
            </p>
            <h1 className="opener-title">{ex.title}</h1>
            {ex.description && <p className="standfirst">{ex.description}</p>}
            <p className="byline">
              Curated by <b>{ex.ownerName}</b><br />
              {ex.items.length} works / {date}
            </p>
            <div className="opener-actions">
              <CopyLink isDraft={ex.visibility !== "PUBLIC"} />
              {ex.isOwner && <Link className="btn btn-sm btn-outline-light" href={`/exhibitions/${ex.id}/edit`}>Edit</Link>}
            </div>
          </div>
          {first && (
            <Link href={`/works/${first.workId}`} className="opener-cover" aria-label={`${first.work.title}, details`}>
              <WorkCover work={first.work} />
            </Link>
          )}
        </div>
      </header>

      <div className="wrap plates">
        {ex.items.map((it, i) => (
          <div key={it.workId}>
            <section className={`plate plate-${i === 0 ? "lead" : i % 2 ? "right" : "left"}`}>
              {i > 0 && (
                <Link href={`/works/${it.workId}`} className="plate-cover" aria-label={`${it.work.title}, details`}>
                  <WorkCover work={it.work} />
                </Link>
              )}
              <div className="plate-text">
                <span className="plate-no">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="plate-title"><Link href={`/works/${it.workId}`}>{it.work.title}</Link></h2>
                <p className="plate-meta">{MEDIUM_KO[it.work.medium]}, {it.work.creator}{it.work.releaseYear ? `, ${it.work.releaseYear}` : ""}</p>
                {it.curatorNote && it !== pulled ? <p className="margin-note">{it.curatorNote}</p> : null}
                {i === 0 && it.work.synopsis && <p className="plate-syn">{it.work.synopsis}</p>}
              </div>
            </section>
            {it === pulled && (
              <blockquote className="pullquote">
                <p>“{pulled.curatorNote}”</p>
                <cite>— on {pulled.work.title}</cite>
              </blockquote>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
