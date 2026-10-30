import type { CSSProperties } from "react";

export interface CoverWork {
  title: string;
  originalTitle?: string | null;
  creator: string;
  medium: "FILM" | "SERIES" | "BOOK" | "ALBUM";
  releaseYear?: number | null;
  coverTone?: string | null;
  artwork?: { url: string; width: number; height: number } | null;
}

export const MEDIUM_LABEL: Record<CoverWork["medium"], string> = { FILM: "Film", SERIES: "Series", BOOK: "Book", ALBUM: "Album" };
export const MEDIUM_PLURAL: Record<CoverWork["medium"], string> = { FILM: "Films", SERIES: "Series", BOOK: "Books", ALBUM: "Albums" };
export const MEDIUM_KO: Record<CoverWork["medium"], string> = { FILM: "영화", SERIES: "시리즈", BOOK: "책", ALBUM: "앨범" };

/** Longest word drives the size so a title never breaks mid-word. */
function titleSize(t: string, medium: CoverWork["medium"]) {
  const words = t.split(/\s+/);
  const longest = Math.max(...words.map((w) => Array.from(w).length));
  const total = Array.from(t).length;
  let s = Math.min(150 / Math.max(longest, 3), total <= 6 ? 34 : total <= 12 ? 24 : total <= 22 ? 18 : 14);
  if (medium === "SERIES") s *= 0.72;
  if (medium === "BOOK") s *= 0.8;
  return `${s.toFixed(1)}cqw`;
}

const initial = (t: string) => Array.from(t.replace(/^(the|a|an)\s+/i, ""))[0] ?? "·";

/**
 * Typographic cover plate. Lecta never imitates real posters or sleeves: each work gets a cover set in type,
 * composed by medium — a film one-sheet, a paperback with spine, a record sleeve with a cropped initial,
 * a wide series frame. Grain + tone give it the warmth of print.
 */
export function WorkCover({ work, showCreator = true, mini = false, className = "" }: { work: CoverWork; showCreator?: boolean; mini?: boolean; className?: string }) {
  const tone = `tone-${work.coverTone ?? "paper"}`;
  const label = `${work.title} — ${work.creator}${work.releaseYear ? `, ${work.releaseYear}` : ""} (typographic cover)`;
  if (mini) {
    return (
      <div className={`cover cover-mini ${tone} ${className}`} data-medium={work.medium} role="img" aria-label={label}>
        <span className="c-initial" aria-hidden>{initial(work.title)}</span>
      </div>
    );
  }
  const style = { "--c-size": titleSize(work.title, work.medium) } as CSSProperties;
  const year = work.releaseYear ?? "";

  let body: React.ReactNode;
  switch (work.medium) {
    case "FILM":
      body = (
        <>
          <div className="c-credit">{showCreator ? <>A film by<br /><b>{work.creator}</b></> : "A film"}</div>
          <div className="c-foot">
            <div className="c-title">{work.title}</div>
            <div className="c-row"><span>{work.originalTitle ?? ""}</span><span>{year}</span></div>
          </div>
        </>
      );
      break;
    case "BOOK":
      body = (
        <>
          <div className="c-author">{showCreator ? work.creator : ""}</div>
          <div className="c-mid">
            <span className="c-orn" />
            <div className="c-title">{work.title}</div>
            {work.originalTitle && <div className="c-orig">{work.originalTitle}</div>}
            <span className="c-orn" />
          </div>
          <div className="c-imprint"><span>Lecta</span><span>{year}</span></div>
        </>
      );
      break;
    case "ALBUM":
      body = (
        <>
          <span className="c-giant">{initial(work.title)}</span>
          <div className="c-artist">{showCreator ? work.creator : ""}</div>
          <div className="c-foot">
            <div className="c-title">{work.title}</div>
            <div className="c-row"><span>LP</span><span>{year}</span></div>
          </div>
        </>
      );
      break;
    default:
      body = (
        <>
          <div className="c-row c-top"><span>Series</span><span>{year}</span></div>
          <div className="c-title">{work.title}</div>
          <div className="c-row"><span>{work.originalTitle ?? ""}</span><span>{showCreator ? work.creator.replace(/\s*\(.*?\)/g, "") : ""}</span></div>
        </>
      );
  }
  return (
    <div className={`cover ${tone} ${className}`} data-medium={work.medium} style={style} role="img" aria-label={label}>
      <div className="c-inner" aria-hidden>{body}</div>
    </div>
  );
}
