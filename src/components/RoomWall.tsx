"use client";
import { useEffect, useRef } from "react";

/**
 * Horizontal gallery wall. On desktop the vertical wheel walks you along the wall; at either end the page
 * scrolls on normally. Arrow keys and trackpads work natively. On narrow screens CSS turns it into a vertical walk.
 */
export function RoomWall({ children }: { children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const horizontal = () => window.matchMedia("(min-width: 821px)").matches;
    const onWheel = (e: WheelEvent) => {
      if (!horizontal() || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= max - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
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
      <div className="track-progress" aria-hidden><i ref={bar} /></div>
    </>
  );
}
