"use client";
import { useEffect, useRef } from "react";
import { sidewaysDelta } from "@/lib/scroll";
import { ScrollArrows } from "./ScrollArrows";

/**
 * Horizontal gallery wall. The vertical wheel always scrolls the page; a sideways swipe, Shift+wheel,
 * arrow keys or the prev/next buttons walk the wall. On narrow screens CSS turns it into a vertical walk.
 */
export function RoomWall({ children }: { children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const dx = sidewaysDelta(e);
      // native scrolling already handles deltaX; only Shift+wheel reported as deltaY needs translating
      if (dx === null || e.deltaX !== 0) return;
      e.preventDefault();
      el.scrollLeft += dx;
    };
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (bar.current) bar.current.style.width = `${max > 0 ? (el.scrollLeft / max) * 100 : 0}%`;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { el.removeEventListener("wheel", onWheel); el.removeEventListener("scroll", onScroll); };
  }, []);
  return (
    <>
      <div ref={track} className="gallery-track" tabIndex={0} aria-label="Exhibition wall — scroll sideways to walk through the room">
        {children}
      </div>
      <div className="track-foot">
        <div className="track-progress" aria-hidden><i ref={bar} /></div>
        <ScrollArrows track={track} label="Exhibition wall" />
      </div>
    </>
  );
}
