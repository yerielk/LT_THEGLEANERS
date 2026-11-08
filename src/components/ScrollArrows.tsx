"use client";
import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Prev/next buttons and a first-glance hint for a sideways scroller. Renders nothing when it cannot scroll. */
export function ScrollArrows({ track, label }: { track: RefObject<HTMLElement | null>; label: string }) {
  const [edge, setEdge] = useState({ start: true, end: true });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [track]);
  if (edge.start && edge.end) return null;
  const step = (dir: -1 | 1) => {
    const el = track.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };
  return (
    <div className="scroll-arrows">
      {edge.start && <span className="scroll-hint">옆으로 넘겨 보세요</span>}
      <button type="button" className="icon-btn" onClick={() => step(-1)} disabled={edge.start} aria-label={`${label}: previous`}><ChevronLeft size={17} /></button>
      <button type="button" className="icon-btn" onClick={() => step(1)} disabled={edge.end} aria-label={`${label}: next`}><ChevronRight size={17} /></button>
    </div>
  );
}
