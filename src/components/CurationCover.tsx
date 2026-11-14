import type { CSSProperties } from "react";
import { wallFor } from "@/lib/design";

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

export function CurationCover({ number, title, className = "" }: { number: number; title: string; className?: string }) {
  const wall = wallFor(number);
  const displayTitle = curationDisplayTitle(title);
  const titleLength = displayTitle.length <= 16 ? "short" : displayTitle.length <= 32 ? "medium" : "long";
  return <div className={`curation-cover curation-cover-card ${className}`} data-title-length={titleLength} style={{ "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties} role="img" aria-label={`Room ${String(number).padStart(2, "0")}: ${displayTitle}`}>
    <CurationIdentity number={number} title={displayTitle} headingAs="span" />
  </div>;
}
