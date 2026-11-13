"use client";
import { useRef } from "react";
import { ScrollArrows } from "./ScrollArrows";

/** The home page's sideways row of works, with a visible way to move along it. */
export function HangRow({ children, label = "On the wall today", className = "" }: { children: React.ReactNode; label?: string; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={track} className={`hang-row ${className}`.trim()} aria-label={label}>{children}</div>
      <div className="wrap"><ScrollArrows track={track} label={label} /></div>
    </>
  );
}
