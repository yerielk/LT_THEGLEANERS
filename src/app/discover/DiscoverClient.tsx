"use client";
import { Link } from "next-view-transitions";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Search, X } from "lucide-react";
import type { WorkView } from "@/lib/services/works";
import { MEDIUM_KO, MEDIUM_PLURAL } from "@/components/WorkCover";
import { WorkImage } from "@/components/WorkImage";
import { SelectButton } from "@/components/SelectButton";
import { useSelection } from "@/lib/selection";
import { useRecommendationSelection } from "@/lib/recommendation/selection";
import { MEDIA, type Medium as WorkMedium } from "@/lib/media";
import { ExternalResults } from "./ExternalResults";

const ORDER = ["FILM", "SERIES", "BOOK", "ALBUM", "TRACK", "PERFORMANCE", "EXHIBITION"];
import { CurationRecommendations } from "./CurationRecommendations";
import { CurationDiscovery } from "./CurationDiscovery";
import { CurationSearchResults } from "./CurationSearchResults";

type Filter = "CURATION" | WorkMedium;
// tracks sit next to albums so music reads as one group
const TAB_ORDER: WorkMedium[] = [...MEDIA].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

/** Re-hang the grid inside a view transition so works glide to their new places. */
function rehang(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(() => flushSync(update));
  else update();
}

export function DiscoverClient({ initial, initialMedium, initialQ = "", initialTag = "", tagLabels, mode = "works" }: { initial: WorkView[]; initialMedium: Filter; initialQ?: string; initialTag?: string; tagLabels: Record<string, string>; mode?: "works" | "curation" }) {
  const [q, setQ] = useState(initialQ);
  const [tag, setTag] = useState(initialTag);
  const [medium, setMedium] = useState<Filter>(initialMedium);
  const [works, setWorks] = useState<WorkView[]>(initial);
  const [total, setTotal] = useState(initial.length);
  const [state, setState] = useState<"idle" | "loading" | "error">(
    initial.length === 0 && initialMedium !== "CURATION" ? "loading" : "idle",
  );
  const [retry, setRetry] = useState(0);
  const first = useRef(true);
  const composing = useRef(false);
  const animate = useRef(false);
  const { has } = useSelection();
  const recommendationSelection = useRecommendationSelection(q, medium);
  const pick = (next: () => void) => { animate.current = true; next(); };
  const changeQuery = (next: string) => { recommendationSelection.changeContext(next, medium); setState("loading"); setQ(next); };
  const changeMedium = (next: Filter) => { recommendationSelection.changeContext(q, next); setState("loading"); setMedium(next); };
  const changeTag = (next: string) => { if (next === tag) return; setState("loading"); setTag(next); };

  useEffect(() => {
    const isInitialLoad = first.current;
    if (isInitialLoad) {
      first.current = false;
      if (medium === "CURATION") return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("medium", medium);
    q.trim() ? url.searchParams.set("q", q.trim()) : url.searchParams.delete("q");
    tag ? url.searchParams.set("tag", tag) : url.searchParams.delete("tag");
    window.history.replaceState(window.history.state, "", url);
    if (medium === "CURATION") {
      setWorks([]);
      setTotal(0);
      setState("idle");
      animate.current = false;
      return;
    }
    const ctl = new AbortController();
    // wait longer while a Hangul syllable is still being composed
    const delay = composing.current ? 700 : 400;
    const t = setTimeout(async () => {
      setState("loading");
      const sp = new URLSearchParams({ limit: "60" });
      if (q.trim()) sp.set("q", q.trim());
      if (tag) sp.set("tag", tag);
      sp.set("medium", medium);
      try {
        const res = await fetch(`/api/works?${sp}`, { signal: ctl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Search failed");
        const apply = () => { setWorks(body.works); setTotal(body.total); setState("idle"); };
        // re-hang only for filter clicks; typing swaps results in place
        if (animate.current) rehang(apply); else apply();
        animate.current = false;
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, delay);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, medium, tag, retry]);

  const detailHref = (id: string) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("medium", medium);
    return `/works/${id}?${params.toString()}`;
  };

  return (
    <>
      <div className="wrap">
        <div className="toolbar" role="search">
          <label className="search">
            <Search size={17} aria-hidden />
            <span className="sr-only">Search works</span>
            <input value={q} onChange={(e) => { animate.current = false; changeQuery(e.target.value); }}
              onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} placeholder={mode === "curation" ? "큐레이션 제목, 담긴 작품, 분위기로 검색 / 퇴근길, Aftersun" : "제목, 창작자, 분위기로 검색 / memory, Ishiguro, 그리움"} />
            {q && <button type="button" onClick={() => changeQuery("")} aria-label="Clear search"><X size={16} /></button>}
          </label>
          {mode === "works" && <div className="toggles" role="group" aria-label="Medium filters">
            {TAB_ORDER.map((m) => (
              <button key={m} type="button" className="toggle" aria-pressed={medium === m} onClick={() => pick(() => changeMedium(m))}>
                {MEDIUM_PLURAL[m]}
              </button>
            ))}
          </div>}
          {mode === "works" && tag && (
            <button type="button" className="tag-chip" onClick={() => pick(() => changeTag(""))} aria-label={`${tagLabels[tag] ?? tag} 태그 필터 해제`}>
              #{tagLabels[tag] ?? tag} <X size={13} aria-hidden />
            </button>
          )}
          <span className="caption" aria-live="polite">{q.trim() || medium !== "CURATION" ? state === "loading" ? "Searching…" : medium === "CURATION" ? "Curation" : `${total} works` : ""}</span>
        </div>
      </div>
      {mode === "curation" && <CurationDiscovery active={medium === "CURATION" && !q.trim()} />}
      {mode === "curation" && medium === "CURATION" && q.trim() && <CurationSearchResults query={q} medium={medium} />}
      {/* Related curations sit in their own band above the grid, so the rows of works are never split. */}
      {medium !== "CURATION" && <div className="wrap"><CurationRecommendations query={q} medium={medium} /></div>}
      {medium === "TRACK" && !q.trim() && !tag && works.length === 0 && state === "idle" && <div className="wrap"><p className="muted" style={{ margin: "40px 0 0" }}>곡은 제목이나 가수 이름으로 검색하면 찾아 와요. 찾은 곡에 + 를 누르면 담겨요.</p></div>}
      {medium !== "CURATION" && <section className="wrap" aria-label="Works">
        {state === "error" ? (
          <div className="empty">
            <p className="notice error" role="alert">
              검색 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.{" "}
              <button className="text-btn" onClick={() => setRetry((n) => n + 1)}>Retry</button>
            </p>
          </div>
        ) : works.length === 0 && (!!q.trim() || !!tag) && state === "idle" ? (
          <div className="empty">
            <p className="h3">“{[q.trim(), tag ? `#${tagLabels[tag] ?? tag}` : ""].filter(Boolean).join(" ")}”에 맞는 작품이 아직 없어요.</p>
            <p className="muted">다른 제목이나 창작자, 혹은 ‘기억’, ‘solitude’ 같은 분위기 단어로 찾아보세요.</p>
            <button className="btn" onClick={() => pick(() => { changeTag(""); changeQuery(""); })}>Reset search</button>
          </div>
        ) : works.length === 0 ? null : (
          <div className="catalog" style={{ opacity: state === "loading" ? 0.6 : 1, transition: "opacity .25s" }}>
            {works.map((w) => {
              return <article key={w.id} className="tile" data-medium={w.medium} data-selected={has(w.id)}>
                  <Link href={detailHref(w.id)} aria-label={`${w.title}, details`} style={{ display: "block" }}>
                    <WorkImage work={w} vt={`work-${w.id}`} />
                  </Link>
                  <div className="meta">
                    <div>
                      <Link href={detailHref(w.id)} className="t-title">{w.title}</Link>
                      <div className="t-sub">{MEDIUM_KO[w.medium]} / {[w.creator.replace(/\s*\(.*?\)/g, ""), w.releaseYear].filter(Boolean).join(", ")}</div>
                      {w.medium === "TRACK" && w.album && <div className="t-sub">수록: {w.album}</div>}
                    </div>
                    <SelectButton work={{ id: w.id, title: w.title, originalTitle: w.originalTitle, creator: w.creator, medium: w.medium, releaseYear: w.releaseYear, coverTone: w.coverTone, artwork: w.artwork }} onAction={() => recommendationSelection.toggle({ id: w.id, title: w.title, originalTitle: w.originalTitle, creator: w.creator, medium: w.medium, releaseYear: w.releaseYear, coverTone: w.coverTone, artwork: w.artwork })} />
                  </div>
                  <div className="tags">{w.tagKeys.slice(0, 3).map((k) => <span key={k}><button type="button" className="tag-link" aria-pressed={tag === k} onClick={() => pick(() => changeTag(k))}>{tagLabels[k] ?? k}</button></span>)}</div>
                </article>
            })}
          </div>
        )}
      </section>}
      {medium !== "CURATION" && <ExternalResults q={q} medium={medium} onSaved={(w) => {
        if (works.some((x) => x.id === w.id)) return;
        setWorks([w, ...works]);
        setTotal(total + 1);
      }} />}
    </>
  );
}
