"use client";
import { useState, type CSSProperties } from "react";
import { WorkCover, type CoverWork } from "./WorkCover";

/**
 * The work as it hangs on the wall: its official artwork when we have one,
 * otherwise (or if the image fails to load) Lecta's typographic cover.
 * `vt` sets a view-transition-name so the piece glides between pages.
 */
export function WorkImage({ work, vt, mini = false, eager = false, className = "" }: { work: CoverWork & { id?: string }; vt?: string; mini?: boolean; eager?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const art = work.artwork;
  const ar = art ? art.width / art.height : work.medium === "ALBUM" ? 1 : work.medium === "SERIES" ? 1.6 : 2 / 3;
  const style = { viewTransitionName: vt, "--ar": ar } as CSSProperties;
  if (!art || failed) {
    return (
      <span className={`art-wrap ${className}`} style={style}>
        <WorkCover work={work} mini={mini} />
      </span>
    );
  }
  return (
    <span className={`art-wrap ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="art"
        src={art.url}
        width={art.width}
        height={art.height}
        alt={`${work.title} — ${work.creator}${work.releaseYear ? `, ${work.releaseYear}` : ""}`}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={{ aspectRatio: `${art.width} / ${art.height}` }}
      />
    </span>
  );
}
