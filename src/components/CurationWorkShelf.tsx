import { Link } from "next-view-transitions";
import { WorkImage } from "./WorkImage";
import type { CoverWork } from "./WorkCover";

export type CurationWorkItem = { workId: string; work: CoverWork & { id?: string } };

export function CurationWorkImage({ work, stage = "preview", eager = false, vt }: {
  work: CoverWork & { id?: string };
  stage?: "preview" | "row" | "gallery";
  eager?: boolean;
  vt?: string;
}) {
  return <span className={`curation-work-art-stage curation-work-art-stage--${stage}`}>
    <WorkImage work={work} className="curation-work-art-image" eager={eager} vt={vt} />
  </span>;
}

export function CurationWorkShelf({ items, hrefForWork, maxItems = 4, showCreator = false, ariaLabel = "Included works", className = "" }: {
  items: CurationWorkItem[];
  hrefForWork?: (workId: string) => string;
  maxItems?: number;
  showCreator?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const visibleItems = items.slice(0, maxItems);
  const remaining = Math.max(0, items.length - visibleItems.length);
  return <div className={`curation-work-shelf${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
    {visibleItems.map(({ workId, work }) => {
      const content = <>
        <CurationWorkImage work={work} stage="preview" />
        <span className="curation-work-title">{work.title}</span>
        {showCreator && <span className="curation-work-creator">{work.creator}</span>}
      </>;
      return hrefForWork
        ? <Link className="curation-work-card" href={hrefForWork(workId)} key={workId} aria-label={`${work.title} details`}>{content}</Link>
        : <span className="curation-work-card" key={workId}>{content}</span>;
    })}
    {remaining > 0 && <span className="curation-work-more">+{remaining}</span>}
  </div>;
}
