"use client";
import { Link } from "next-view-transitions";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Search, X } from "lucide-react";
import type { WorkView } from "@/lib/services/works";
import { MEDIUM_PLURAL, MEDIUM_KO } from "@/components/WorkCover";
import { WorkImage } from "@/components/WorkImage";
import { SelectButton } from "@/components/SelectButton";
import { SelectionShelf } from "@/components/SelectionShelf";
import { useSelection } from "@/lib/selection";

const MEDIA = ["ALL", "FILM", "SERIES", "BOOK", "ALBUM"] as const;
type M = (typeof MEDIA)[number];

/** Re-hang the grid inside a view transition so works glide to their new places. */
function rehang(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(() => flushSync(update));
  else update();
}

export function DiscoverClient({ initial, initialMedium, initialQ = "", moods, tagLabels }: { initial: WorkView[]; initialMedium: M; initialQ?: string; moods: string[]; tagLabels: Record<string, string> }) {
  const [q, setQ] = useState(initialQ);
  const [medium, setMedium] = useState<M>(initialMedium);
  const [works, setWorks] = useState<WorkView[]>(initial);
  const [total, setTotal] = useState(initial.length);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [retry, setRetry] = useState(0);
  const first = useRef(true);
  const { has } = useSelection();

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setState("loading");
      const sp = new URLSearchParams({ limit: "60" });
      if (q.trim()) sp.set("q", q.trim());
      if (medium !== "ALL") sp.set("medium", medium);
      try {
        const res = await fetch(`/api/works?${sp}`, { signal: ctl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Search failed");
        rehang(() => { setWorks(body.works); setTotal(body.total); setState("idle"); });
        const url = new URL(window.location.href);
        medium === "ALL" ? url.searchParams.delete("medium") : url.searchParams.set("medium", medium);
        q.trim() ? url.searchParams.set("q", q.trim()) : url.searchParams.delete("q");
        window.history.replaceState(window.history.state, "", url);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, medium, retry]);

  return (
    <>
      <div className="wrap">
        <p className="mood-strip" aria-label="Moods">
          {moods.map((m) => <button key={m} type="button" aria-pressed={q === m} onClick={() => setQ(q === m ? "" : m)}>{m}</button>)}
        </p>
        <div className="toolbar" role="search">
          <label className="search">
            <Search size={17} aria-hidden />
            <span className="sr-only">Search works</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목, 창작자, 분위기로 검색 — memory, Ishiguro, 그리움" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <div className="toggles" role="group" aria-label="Filter by medium">
            {MEDIA.map((m) => (
              <button key={m} type="button" className="toggle" aria-pressed={medium === m} onClick={() => setMedium(m)}>
                {m === "ALL" ? "All" : MEDIUM_PLURAL[m]}
              </button>
            ))}
          </div>
          <span className="caption" aria-live="polite">{state === "loading" ? "Searching…" : `${total} works`}</span>
        </div>
      </div>
      <section className="wrap" aria-label="Works">
        {state === "error" ? (
          <div className="empty">
            <p className="notice error" role="alert">
              검색 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.{" "}
              <button className="text-btn" onClick={() => setRetry((n) => n + 1)}>Retry</button>
            </p>
          </div>
        ) : works.length === 0 ? (
          <div className="empty">
            <p className="h3">“{q}”에 맞는 작품이 아직 없어요.</p>
            <p className="muted">다른 제목이나 창작자, 혹은 ‘기억’, ‘solitude’ 같은 분위기 단어로 찾아보세요.</p>
            <button className="btn" onClick={() => { setQ(""); setMedium("ALL"); }}>Reset search</button>
          </div>
        ) : (
          <div className="catalog" style={{ opacity: state === "loading" ? 0.6 : 1, transition: "opacity .25s" }}>
            {works.map((w) => (
              <article key={w.id} className="tile" data-medium={w.medium} data-selected={has(w.id)}>
                <Link href={`/works/${w.id}`} aria-label={`${w.title}, details`} style={{ display: "block" }}>
                  <WorkImage work={w} vt={`work-${w.id}`} />
                </Link>
                <div className="meta">
                  <div>
                    <Link href={`/works/${w.id}`} className="t-title">{w.title}</Link>
                    <div className="t-sub">{MEDIUM_KO[w.medium]} / {w.creator.replace(/\s*\(.*?\)/g, "")}, {w.releaseYear}</div>
                  </div>
                  <SelectButton work={{ id: w.id, title: w.title, originalTitle: w.originalTitle, creator: w.creator, medium: w.medium, releaseYear: w.releaseYear, coverTone: w.coverTone, artwork: w.artwork }} />
                </div>
                <div className="tags">{w.tagKeys.slice(0, 3).map((k) => <span key={k}>{tagLabels[k] ?? k}</span>)}</div>
              </article>
            ))}
          </div>
        )}
      </section>
      <SelectionShelf alwaysVisible />
    </>
  );
}
