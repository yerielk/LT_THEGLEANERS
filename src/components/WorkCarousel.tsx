"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "next-view-transitions";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ExhibitionItemView } from "@/lib/services/exhibitions";
import { WorkImage } from "./WorkImage";

const SIDE_SCALE = 0.2;   // how much smaller a work one step from the centre is
const SIDE_DIM = 0.5;     // how much darker it is
const SIDE_FADE = 0.35;   // how much more see-through it gets further out

/**
 * A curation's works on one line. The work in the centre is full size and lit; its neighbours sit
 * smaller and darker, and come forward as you swipe or step to them.
 */
export function WorkCarousel({ items, label }: { items: ExhibitionItemView[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Pad both ends so the first and last work can sit in the centre.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const pad = () => {
      const kids = el.children as HTMLCollectionOf<HTMLElement>;
      if (!kids.length) return;
      el.style.paddingLeft = `${Math.max(0, el.clientWidth / 2 - kids[0].offsetWidth / 2)}px`;
      el.style.paddingRight = `${Math.max(0, el.clientWidth / 2 - kids[kids.length - 1].offsetWidth / 2)}px`;
    };
    pad();
    const ro = new ResizeObserver(pad);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items]);

  // Size and light each work by how far it is from the centre.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0, bestD = Infinity;
      Array.from(el.children as HTMLCollectionOf<HTMLElement>).forEach((kid, i) => {
        const w = kid.offsetWidth;
        const d = (kid.offsetLeft + w / 2 - mid) / w;
        const a = Math.min(Math.abs(d), 2);
        const scale = 1 - Math.min(a, 1.5) * SIDE_SCALE;
        // pull the smaller neighbours in a little, so the gaps stay even
        const pull = -Math.sign(d) * (1 - scale) * w * 0.5;
        kid.style.setProperty("--s", scale.toFixed(3));
        kid.style.setProperty("--x", `${pull.toFixed(1)}px`);
        kid.style.setProperty("--b", (1 - Math.min(a, 1) * SIDE_DIM).toFixed(3));
        kid.style.setProperty("--o", (1 - Math.max(0, a - 1) * SIDE_FADE).toFixed(3));
        kid.style.zIndex = String(10 - Math.round(a * 3));
        if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = i; }
      });
      setActive(best);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    el.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    // images settle their widths as they load
    el.querySelectorAll("img").forEach((img) => img.addEventListener("load", queue));
    return () => { el.removeEventListener("scroll", queue); window.removeEventListener("resize", queue); if (raf) cancelAnimationFrame(raf); };
  }, [items]);

  const go = useCallback((i: number) => {
    const el = track.current;
    const kid = el?.children[Math.max(0, Math.min(items.length - 1, i))] as HTMLElement | undefined;
    if (!el || !kid) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: kid.offsetLeft + kid.offsetWidth / 2 - el.clientWidth / 2, behavior: reduce ? "auto" : "smooth" });
  }, [items.length]);

  const cur = items[active];
  return (
    <div className="carousel">
      <div ref={track} className="carousel-track" role="group" aria-roledescription="carousel" aria-label={label} tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
        }}>
        {items.map((it, i) => (
          <div key={it.workId} className="carousel-item" aria-current={i === active ? "true" : undefined}>
            {i === active ? (
              <Link href={`/works/${it.workId}`} className="carousel-art" aria-label={`${it.work.title}, details`}>
                <WorkImage work={it.work} eager />
              </Link>
            ) : (
              <button type="button" className="carousel-art" onClick={() => go(i)} aria-label={`${it.work.title}, 가운데로`} tabIndex={-1}>
                <WorkImage work={it.work} eager />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="wrap carousel-foot">
        <div className="carousel-caption" aria-live="polite" key={cur?.workId}>
          {cur && <>
            <p className="carousel-title">{cur.work.title}</p>
            <p className="carousel-by">{cur.work.creator}{cur.work.releaseYear ? `, ${cur.work.releaseYear}` : ""}</p>
            {cur.curatorNote && <p className="carousel-note">“{cur.curatorNote}”</p>}
          </>}
        </div>
        <div className="carousel-nav">
          <span className="carousel-count">{String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
          <button type="button" className="icon-btn" onClick={() => go(active - 1)} disabled={active === 0} aria-label="이전 작품"><ChevronLeft size={17} /></button>
          <button type="button" className="icon-btn" onClick={() => go(active + 1)} disabled={active === items.length - 1} aria-label="다음 작품"><ChevronRight size={17} /></button>
        </div>
      </div>
    </div>
  );
}
