"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { WorkView } from "@/lib/services/works";
import { WorkCover, MEDIUM_PLURAL } from "@/components/WorkCover";
import { SelectButton } from "@/components/SelectButton";
import { SelectionShelf } from "@/components/SelectionShelf";
import { useSelection } from "@/lib/selection";

const MEDIA = ["ALL", "FILM", "SERIES", "BOOK", "ALBUM"] as const;
type M = (typeof MEDIA)[number];

export function DiscoverClient({ initial, initialMedium, tagLabels }: { initial: WorkView[]; initialMedium: M; tagLabels: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [medium, setMedium] = useState<M>(initialMedium);
  const [works, setWorks] = useState<WorkView[]>(initial);
  const [total, setTotal] = useState(initial.length);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
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
        setWorks(body.works); setTotal(body.total); setState("idle");
        const url = new URL(window.location.href);
        medium === "ALL" ? url.searchParams.delete("medium") : url.searchParams.set("medium", medium);
        window.history.replaceState(null, "", url);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, medium]);

  return (
    <>
      <div className="wrap">
        <div className="toolbar" role="search">
          <label className="search">
            <Search size={18} aria-hidden />
            <span className="sr-only">Search works</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목, 창작자, 분위기로 검색 — memory, Ishiguro, 그리움" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" style={{ background: "none", border: 0 }}><X size={16} /></button>}
          </label>
          <div className="filters" role="group" aria-label="Filter by medium">
            {MEDIA.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={medium === m} onClick={() => setMedium(m)}>
                {m === "ALL" ? "All" : MEDIUM_PLURAL[m]}
              </button>
            ))}
          </div>
          <span className="caption" aria-live="polite">{state === "loading" ? "Searching…" : `${total} works`}</span>
        </div>
      </div>
      <div className="wrap works-layout">
        <section aria-label="Works">
          {state === "error" ? (
            <div className="notice error" role="alert">
              검색 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.{" "}
              <button className="linkish" style={{ background: "none", border: 0 }} onClick={() => setQ((v) => v + "")}>Retry</button>
            </div>
          ) : works.length === 0 ? (
            <div className="empty">
              <p className="h3" style={{ margin: 0 }}>“{q}”에 맞는 작품이 아직 없어요.</p>
              <p className="muted">다른 제목이나 창작자, 혹은 ‘기억’, ‘solitude’ 같은 분위기 단어로 찾아보세요.</p>
              <button className="btn btn-ghost" onClick={() => { setQ(""); setMedium("ALL"); }}>Reset search</button>
            </div>
          ) : (
            <div className="works-grid" style={{ opacity: state === "loading" ? 0.55 : 1, transition: "opacity .2s" }}>
              {works.map((w) => (
                <article key={w.id} className="tile" data-selected={has(w.id)}>
                  <Link href={`/works/${w.id}`} aria-label={`${w.title}, details`}><WorkCover work={w} /></Link>
                  <div className="meta">
                    <Link href={`/works/${w.id}`} className="t-title">{w.title}</Link>
                    <SelectButton work={{ id: w.id, title: w.title, originalTitle: w.originalTitle, creator: w.creator, medium: w.medium, releaseYear: w.releaseYear, coverTone: w.coverTone }} />
                  </div>
                  <div className="t-sub">{w.creator}, {w.releaseYear}</div>
                  <div className="tags">{w.tagKeys.slice(0, 3).map((k) => <span key={k}>{tagLabels[k] ?? k}</span>)}</div>
                </article>
              ))}
            </div>
          )}
        </section>
        <SelectionShelf />
      </div>
    </>
  );
}
