"use client";
import { Link } from "next-view-transitions";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Search, X } from "lucide-react";
import type { CurationHit } from "@/lib/services/curations";
import { WorkImage } from "@/components/WorkImage";
import { wallFor } from "@/lib/design";

const MATCHED_KO: Record<CurationHit["matched"][number], string> = {
  title: "제목", description: "소개", work: "담긴 작품", note: "큐레이터 노트", tag: "분위기", curator: "큐레이터",
};

export function CurationsClient({ initial, initialQ }: { initial: CurationHit[]; initialQ: string }) {
  const [q, setQ] = useState(initialQ);
  const [hits, setHits] = useState(initial);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [retry, setRetry] = useState(0);
  const first = useRef(true);
  const composing = useRef(false);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setState("loading");
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      try {
        const res = await fetch(`/api/curations?${sp}`, { signal: ctl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Search failed");
        setHits(body.curations);
        setState("idle");
        const url = new URL(window.location.href);
        q.trim() ? url.searchParams.set("q", q.trim()) : url.searchParams.delete("q");
        window.history.replaceState(window.history.state, "", url);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, composing.current ? 700 : 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, retry]);

  return (
    <>
      <div className="wrap">
        <div className="toolbar" role="search">
          <label className="search">
            <Search size={17} aria-hidden />
            <span className="sr-only">Search curations</span>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
              placeholder="큐레이션 제목, 담긴 작품, 분위기로 검색 — 그리움, Aftersun" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <span className="caption" aria-live="polite">{state === "loading" ? "Searching…" : `${hits.length} curations`}</span>
        </div>
      </div>
      <section className="wrap" aria-label="Curations" style={{ paddingBottom: 160 }}>
        {state === "error" ? (
          <div className="empty">
            <p className="notice error" role="alert">
              검색 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.{" "}
              <button className="text-btn" onClick={() => setRetry((n) => n + 1)}>Retry</button>
            </p>
          </div>
        ) : hits.length === 0 ? (
          <div className="empty">
            <p className="h3">“{q}”에 맞는 큐레이션이 아직 없어요.</p>
            <p className="muted">다른 작품 이름이나 ‘기억’, ‘고독’ 같은 분위기 단어로 찾아보세요. 직접 만들어 볼 수도 있어요.</p>
            <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setQ("")}>Reset search</button>
              <Link className="btn-ghost" href="/exhibitions/new">새 큐레이션 만들기</Link>
            </div>
          </div>
        ) : (
          <div className="me-list" style={{ opacity: state === "loading" ? 0.6 : 1, transition: "opacity .25s" }}>
            {hits.map(({ curation: ex, matched }) => {
              const wall = wallFor(ex.number);
              return (
                <article key={ex.id} className="me-row" style={{ "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties}>
                  <Link href={`/exhibitions/${ex.id}`} className="me-swatch" style={{ viewTransitionName: `room-${ex.id}` }} aria-label={`${ex.title}, open`}>
                    {String(ex.number).padStart(2, "0")}
                  </Link>
                  <div>
                    <p className="caption" style={{ margin: 0 }}>
                      <span className="nobr">Curated by {ex.ownerName}</span> / <span className="nobr">{ex.items.length} works</span>
                      {matched.length > 0 && <> / <span className="nobr">{matched.map((m) => MATCHED_KO[m]).join(", ")}에서 찾음</span></>}
                    </p>
                    <Link href={`/exhibitions/${ex.id}`} className="h3" style={{ display: "block", margin: "6px 0 6px" }}>{ex.title}</Link>
                    {ex.description && <p className="muted" style={{ margin: "0 0 10px", fontSize: 14.5, maxWidth: "46em" }}>{ex.description}</p>}
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }} aria-hidden>
                      {ex.items.slice(0, 6).map((i) => <span key={i.workId} style={{ height: 52, display: "block", aspectRatio: i.work.artwork ? `${i.work.artwork.width} / ${i.work.artwork.height}` : "2 / 3" }}><WorkImage work={i.work} /></span>)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                    <Link className="btn btn-sm" href={`/exhibitions/${ex.id}`}>Enter</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
