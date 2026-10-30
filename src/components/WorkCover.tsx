import type { CSSProperties } from "react";

export interface CoverWork {
  title: string;
  originalTitle?: string | null;
  creator: string;
  medium: "FILM" | "SERIES" | "BOOK" | "ALBUM";
  releaseYear?: number | null;
  coverTone?: string | null;
}

export const MEDIUM_LABEL: Record<CoverWork["medium"], string> = { FILM: "Film", SERIES: "Series", BOOK: "Book", ALBUM: "Album" };
export const MEDIUM_KO: Record<CoverWork["medium"], string> = { FILM: "영화", SERIES: "시리즈", BOOK: "책", ALBUM: "앨범" };

function titleSize(t: string, medium: CoverWork["medium"]) {
  const n = t.length;
  const base = n <= 4 ? 30 : n <= 8 ? 21 : n <= 14 ? 15.5 : n <= 22 ? 12.5 : 10.5;
  return `${medium === "SERIES" ? base * 0.8 : base}cqw`;
}

/**
 * Typographic cover plate. Lecta never imitates real posters or sleeves: each work gets a cover
 * set in type, shaped by its medium (film poster, book with spine, square record, wide series frame).
 */
export const MEDIUM_PLURAL: Record<CoverWork["medium"], string> = { FILM: "Films", SERIES: "Series", BOOK: "Books", ALBUM: "Albums" };

export function WorkCover({ work, showCreator = true, mini = false, className = "" }: { work: CoverWork; showCreator?: boolean; mini?: boolean; className?: string }) {
  if (mini) {
    // thumbnails are too small for type: show the medium shape, tone and the title's first letter
    return (
      <div className={`cover cover-mini tone-${work.coverTone ?? "paper"} ${className}`} data-medium={work.medium} role="img" aria-label={`${work.title} (typographic cover)`}>
        <span className="c-initial" aria-hidden>{Array.from(work.title)[0]}</span>
      </div>
    );
  }
  const style = { "--c-size": titleSize(work.title, work.medium) } as CSSProperties;
  return (
    <div className={`cover tone-${work.coverTone ?? "paper"} ${className}`} data-medium={work.medium} style={style} role="img"
      aria-label={`${work.title} — ${work.creator}${work.releaseYear ? `, ${work.releaseYear}` : ""} (typographic cover)`}>
      <div className="c-top" aria-hidden>
        <span>{MEDIUM_LABEL[work.medium]}</span>
        <span>{work.releaseYear ?? ""}</span>
      </div>
      <span className="c-mark" aria-hidden />
      <div aria-hidden>
        <div className="c-title">{work.title}</div>
        {work.originalTitle && <div className="c-orig">{work.originalTitle}</div>}
      </div>
      {showCreator ? <div className="c-creator" aria-hidden>{work.creator}</div> : <span />}
    </div>
  );
}
