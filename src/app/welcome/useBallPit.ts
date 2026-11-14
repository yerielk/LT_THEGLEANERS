"use client";
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * A small ball pit: each work is a ball that falls, bounces, slides along the floor and pushes the others aside.
 * Balls never spin, so the artwork always reads upright.
 * Positions live in refs and are written straight to the DOM every frame, so React only re-renders when
 * the list of works or the picks change.
 */

const GRAVITY = 2200; // px/s²
const RESTITUTION = 0.35; // bounce between balls
const FLOOR_BOUNCE = 0.3;
const ROLL_FRICTION = 0.992; // per substep while touching the floor
const AIR = 0.9995;
const SUBSTEPS = 4;
const GROW = 1.75; // a picked ball grows to this much of its size
const GAP = 10; // px kept between balls (scaled down on small screens)
const MAX_SPEED = 3000;
// settling a pile: each ball sits on others, so gravity pulls it in and the overlap fix pushes it out every frame.
// Several soft passes, a little allowed overlap, no bounce on slow contacts and damping near rest stop that buzz.
const SOLVER_PASSES = 3;
const SLOP = 0.5; // px of overlap left alone
const CORRECTION = 0.8; // share of the overlap fixed per pass
const BOUNCE_MIN = 60; // px/s: slower contacts do not bounce
const REST_SPEED = 25; // px/s: below this a touching ball is damped toward rest
const DRAW_EPS = 0.6; // px: smaller moves are not drawn

interface Body {
  x: number; y: number; vx: number; vy: number;
  r: number; base: number; target: number; drawnR: number; drawnX: number; drawnY: number; touching: boolean;
  el: HTMLElement | null;
  placed: boolean; selected: boolean; held: boolean; seed: number;
  spawn?: { x?: number; selected?: boolean };
}

/** A stable pseudo-random number per id, so a work keeps its size across visits. */
function seeded(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function useBallPit() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const bodies = useRef(new Map<string, Body>());
  const pendingSpawn = useRef(new Map<string, Body["spawn"]>());
  const size = useRef({ w: 0, h: 0 });
  const drag = useRef<{ id: string; ox: number; oy: number; px: number; py: number; startX: number; startY: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const dropBatch = useRef(0);

  useEffect(() => {
    // the pit unmounts while the result shows and comes back on "다시 고르기", so follow whichever node is current
    let observed: HTMLDivElement | null = null;
    const ro = new ResizeObserver(() => { if (observed) size.current = { w: observed.clientWidth, h: observed.clientHeight }; });
    const follow = () => {
      const field = fieldRef.current;
      if (field === observed) return;
      if (observed) ro.unobserve(observed);
      observed = field;
      if (field) { ro.observe(field); size.current = { w: field.clientWidth, h: field.clientHeight }; }
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      follow();
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  function scale() {
    return Math.max(0.6, Math.min(1, size.current.w / 1100));
  }

  function place(b: Body, i: number) {
    const { w } = size.current;
    const s = scale();
    b.base = (40 + b.seed * 22) * s;
    b.target = b.selected ? b.base * GROW : b.base;
    b.r = b.target;
    if (b.spawn?.x !== undefined) {
      // dropped from the search box: start just under it, inside the pit
      b.x = Math.max(b.r, Math.min(w - b.r, b.spawn.x));
      b.y = b.r + 4;
      b.vx = 0; b.vy = 0;
    } else {
      b.x = b.r + Math.random() * Math.max(1, w - 2 * b.r);
      b.y = -b.r - i * b.r * 0.9 - dropBatch.current * 10;
      b.vx = (Math.random() - 0.5) * 240;
      b.vy = 0;
    }
    b.placed = true;
  }

  function step(dt: number) {
    const { w, h } = size.current;
    if (!w || !h) return;
    const list: Body[] = [];
    let unplaced = 0;
    for (const [id, b] of bodies.current) {
      if (!b.el) { bodies.current.delete(id); continue; } // unmounted
      if (!b.placed) place(b, unplaced++);
      list.push(b);
    }
    if (unplaced) dropBatch.current++;

    const sdt = dt / SUBSTEPS;
    const gap = GAP * scale();
    const held = drag.current ? bodies.current.get(drag.current.id) : undefined;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const b of list) {
        b.touching = false;
        b.r += (b.target - b.r) * Math.min(1, 12 * sdt);
        if (b === held && drag.current) {
          const tx = drag.current.px - drag.current.ox, ty = drag.current.py - drag.current.oy;
          b.vx = (tx - b.x) / dt; b.vy = (ty - b.y) / dt;
          b.x += (tx - b.x) / SUBSTEPS; b.y += (ty - b.y) / SUBSTEPS;
        } else {
          b.vy += GRAVITY * sdt;
          b.vx *= AIR; b.vy *= AIR;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
          b.x += b.vx * sdt; b.y += b.vy * sdt;
        }
        // walls and floor; the top stays open so new balls can fall in
        if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx = -b.vx * FLOOR_BOUNCE; }
        if (b.x > w - b.r) { b.x = w - b.r; if (b.vx > 0) b.vx = -b.vx * FLOOR_BOUNCE; }
        if (b.y > h - b.r) {
          b.y = h - b.r;
          if (b.vy > 0) b.vy = b.vy > 120 ? -b.vy * FLOOR_BOUNCE : 0;
          b.vx *= ROLL_FRICTION;
          b.touching = true;
        }
      }
      // ball against ball: push apart by mass (area), then exchange momentum along the contact normal
      for (let pass = 0; pass < SOLVER_PASSES; pass++) for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const c = list[j];
          const dx = c.x - a.x, dy = c.y - a.y;
          const min = a.r + c.r + gap;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2) || 0.01;
          const nx = dx / d, ny = dy / d;
          const ma = a === held ? 1e9 : a.r * a.r, mc = c === held ? 1e9 : c.r * c.r;
          a.touching = c.touching = true;
          const overlap = (min - d - SLOP) * CORRECTION;
          if (overlap <= 0) continue;
          const total = ma + mc;
          a.x -= nx * overlap * (mc / total); a.y -= ny * overlap * (mc / total);
          c.x += nx * overlap * (ma / total); c.y += ny * overlap * (ma / total);
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel < 0) {
            const e = -rel > BOUNCE_MIN ? RESTITUTION : 0;
            const jImp = (-(1 + e) * rel) / (1 / ma + 1 / mc);
            a.vx -= (jImp / ma) * nx; a.vy -= (jImp / ma) * ny;
            c.vx += (jImp / mc) * nx; c.vy += (jImp / mc) * ny;
          }
        }
      }
      // let a slow ball that is touching something come to rest instead of trembling in place
      for (const b of list) {
        if (b === held || !b.touching) continue;
        const speed = Math.hypot(b.vx, b.vy);
        if (speed < REST_SPEED / 4) { b.vx = 0; b.vy = 0; } else if (speed < REST_SPEED) { b.vx *= 0.6; b.vy *= 0.6; }
      }
    }
  }

  function draw() {
    for (const b of bodies.current.values()) {
      if (!b.el || !b.placed) continue;
      const resized = Math.abs(b.r - b.drawnR) > 0.25;
      if (resized) {
        b.el.style.width = b.el.style.height = `${(b.r * 2).toFixed(1)}px`;
        b.drawnR = b.r;
      }
      if (!resized && Math.abs(b.x - b.drawnX) < DRAW_EPS && Math.abs(b.y - b.drawnY) < DRAW_EPS) continue;
      b.drawnX = b.x; b.drawnY = b.y;
      b.el.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px, 0)`;
    }
  }

  function onMove(e: PointerEvent) {
    const d = drag.current, field = fieldRef.current;
    if (!d || !field) return;
    const rect = field.getBoundingClientRect();
    d.px = e.clientX - rect.left; d.py = e.clientY - rect.top;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.moved = true;
  }

  function onUp() {
    const d = drag.current;
    if (d) {
      const b = bodies.current.get(d.id);
      if (b) b.held = false;
      dragged.current = d.moved;
    }
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  }

  // stable across renders so the ref callbacks and handlers below do not churn
  return useMemo(() => ({
    fieldRef,

    /** Ref callback for a ball. React calls it with null and again with the node on re-render, so keep the body. */
    register(id: string, el: HTMLElement | null) {
      const b = bodies.current.get(id);
      if (!el) { if (b) b.el = null; return; }
      if (b) { b.el = el; return; }
      const spawn = pendingSpawn.current.get(id);
      pendingSpawn.current.delete(id);
      bodies.current.set(id, {
        x: 0, y: 0, vx: 0, vy: 0, r: 0, base: 0, target: 0, drawnR: 0, drawnX: NaN, drawnY: NaN, touching: false,
        el,
        placed: false, selected: !!spawn?.selected || el.getAttribute("aria-pressed") === "true", held: false, seed: seeded(id), spawn,
      });
    },

    /** Grow or shrink a ball; a growing ball gets a small hop so its neighbours make room. */
    setSelected(id: string, on: boolean) {
      const b = bodies.current.get(id);
      if (!b) { const s = pendingSpawn.current.get(id); if (s) s.selected = on; return; }
      b.selected = on;
      if (!b.placed) return;
      b.target = on ? b.base * GROW : b.base;
      if (on) b.vy -= 380;
    },

    /** Call before the ball renders: where it drops in, and whether it starts picked. */
    queueSpawn(id: string, spawn: Body["spawn"]) {
      pendingSpawn.current.set(id, { ...spawn });
    },

    /** Toss a ball that is already in the pit, to show where it is. */
    bump(id: string) {
      const b = bodies.current.get(id);
      if (b) { b.vy = -1100; b.vx += (Math.random() - 0.5) * 300; }
    },

    grab(id: string, e: ReactPointerEvent<HTMLElement>) {
      const b = bodies.current.get(id), field = fieldRef.current;
      if (!b || !field || e.button !== 0) return;
      const rect = field.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      drag.current = { id, ox: px - b.x, oy: py - b.y, px, py, startX: e.clientX, startY: e.clientY, moved: false };
      dragged.current = false;
      b.held = true;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },

    /** True once after a drag, so the click that ends a throw does not also toggle the ball. */
    wasDragged() {
      const v = dragged.current;
      dragged.current = false;
      return v;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
}
