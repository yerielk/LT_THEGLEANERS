import type { CSSProperties } from "react";
import { wallFor } from "@/lib/design";

export const curationDisplayTitle = (title: string) => title.replace(/\s*[·•]\s*/g, " ");

/** Shared curation identity used by the exhibition entrance wall and compact cover views. */
export function CurationIdentity({ number, title, description, status, headingAs = "h1" }: {
  number: number;
  title: string;
  description?: string | null;
  status?: string;
  headingAs?: "h1" | "span";
}) {
  const Heading = headingAs;
  return <>
    <span className="room-no">
      <span className="nobr">Room {String(number).padStart(2, "0")}</span>
      {status && <> / <span className="nobr">{status}</span></>}
    </span>
    <div>
      <Heading className="room-title">{curationDisplayTitle(title)}</Heading>
      {description && <p className="standfirst">{description}</p>}
    </div>
  </>;
}

export function CurationCover({ number, title, className = "" }: { number: number; title: string; className?: string }) {
  const wall = wallFor(number);
  const titleLength = title.length <= 24 ? "short" : title.length <= 48 ? "medium" : title.length <= 80 ? "long" : "extended";
  return <div className={`curation-cover curation-cover-card ${className}`} data-title-length={titleLength} style={{ "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties} role="img" aria-label={`Room ${String(number).padStart(2, "0")}: ${title}`}>
    <CurationIdentity number={number} title={title} headingAs="span" />
  </div>;
}
