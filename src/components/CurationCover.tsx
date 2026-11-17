import type { CSSProperties } from "react";
import { wallFor } from "@/lib/design";
import { coverTheme } from "@/lib/curation/cover-theme";
import { WorkImage } from "./WorkImage";
import type { CoverWork } from "./WorkCover";

export function curationDisplayTitle(title: string | null | undefined) {
  return typeof title === "string" && title.trim() && title.trim().toLowerCase() !== "undefined"
    ? title.trim()
    : "Untitled curation";
}

/** Shared curation identity used by the exhibition entrance wall and compact cover views. */
export function CurationIdentity({ number, title, description, status, headingAs = "h1" }: {
  number: number;
  title: string;
  description?: string | null;
  status?: string;
  headingAs?: "h1" | "span";
}) {
  const Heading = headingAs;
  const displayTitle = curationDisplayTitle(title);
  return <>
    <span className="room-no">
      <span className="nobr">Room {String(number).padStart(2, "0")}</span>
      {status && <> / <span className="nobr">{status}</span></>}
    </span>
    <div>
      <Heading className="room-title">{displayTitle}</Heading>
      {description && <p className="standfirst">{description}</p>}
    </div>
  </>;
}

type HungWork = { workId: string; work: CoverWork & { id?: string } };

/**
 * A curation's cover is its own wall: up to three of its works hung on the room colour.
 * The arrangement is picked from the room number, so every curation keeps one recognisable face
 * and neighbouring cards do not repeat the same composition. Without works it falls back to the title.
 */
export function CurationCover({ number, title, works, className = "" }: { number: number; title: string; works?: HungWork[]; className?: string }) {
  const displayTitle = curationDisplayTitle(title);
  const hung = (works ?? []).slice(0, 3);
  // the wall colour and the chips come from the hung works' own artwork colours
  const theme = hung.length ? coverTheme(number, hung.map((item) => item.work)) : null;
  const wall = theme ?? wallFor(number);
  const style = { "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties;
  const label = `Room ${String(number).padStart(2, "0")}: ${displayTitle}`;
  if (hung.length) {
    return <div className={`curation-cover curation-wall ${className}`} data-hang={["row", "lead", "step", "lean"][number % 4]} data-count={hung.length} style={style} role="img" aria-label={label}>
      <span className="room-no">Room {String(number).padStart(2, "0")}</span>
      <span className="curation-hang" aria-hidden>
        {hung.map(({ workId, work }) => <WorkImage key={workId} work={work} mini />)}
      </span>
      {theme && theme.chips.length > 1 && <span className="curation-chips" aria-hidden>{theme.chips.map((hex) => <i key={hex} style={{ background: hex }} />)}</span>}
    </div>;
  }
  const titleLength = displayTitle.length <= 16 ? "short" : displayTitle.length <= 32 ? "medium" : "long";
  return <div className={`curation-cover curation-cover-card ${className}`} data-title-length={titleLength} style={style} role="img" aria-label={label}>
    <CurationIdentity number={number} title={displayTitle} headingAs="span" />
  </div>;
}
