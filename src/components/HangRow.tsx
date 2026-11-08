"use client";
import { useRef } from "react";
import { ScrollArrows } from "./ScrollArrows";

/** The home page's sideways row of works, with a visible way to move along it. */
export function HangRow({ children }: { children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={track} className="hang-row" aria-label="On the wall today">{children}</div>
      <div className="wrap"><ScrollArrows track={track} label="On the wall today" /></div>
    </>
  );
}
