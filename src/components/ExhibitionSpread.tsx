import Link from "next/link";
import { WorkCover, type CoverWork } from "./WorkCover";

export interface SpreadItem { workId: string; work: CoverWork; curatorNote?: string | null }

/** Layout template editorial-01: asymmetric two-column spread, sizes alternate so no two neighbours match. */
export function ExhibitionSpread({ items, compact = false, linkWorks = true }: { items: SpreadItem[]; compact?: boolean; linkWorks?: boolean }) {
  return (
    <div className={`spread${compact ? " compact" : ""}`}>
      {items.map((it, i) => {
        const cover = <WorkCover work={it.work} />;
        return (
          <figure key={it.workId}>
            {linkWorks ? <Link href={`/works/${it.workId}`} aria-label={`${it.work.title}, details`}>{cover}</Link> : cover}
            <figcaption>
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="serif" style={{ fontSize: compact ? 18 : 22 }}>{it.work.title}</span>
                <span className="muted" style={{ fontSize: 13, display: "block" }}>{it.work.creator}{it.work.releaseYear ? `, ${it.work.releaseYear}` : ""}</span>
                {it.curatorNote && <p className="note">“{it.curatorNote}”</p>}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
