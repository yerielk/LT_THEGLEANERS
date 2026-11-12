"use client";
import { Link } from "next-view-transitions";
import { useEffect, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { WorkView } from "@/lib/services/works";
import type { SavedTaste } from "@/lib/services/taste";
import { MEDIUM_KO, WorkCover, type CoverWork } from "@/components/WorkCover";
import { WorkImage } from "@/components/WorkImage";
import { useBallPit } from "./useBallPit";

const FIRST = 24;
const MORE = 12;

const creatorName = (c: string) => c.replace(/\s*\(.*?\)/g, "");

export function WelcomeClient({ pool, initialPicked, next, min, max, userName }: {
  pool: WorkView[]; initialPicked: WorkView[]; next: string; min: number; max: number; userName: string | null;
}) {
  // the pit starts with what the user picked before, then the mixed shelf
  const [shown, setShown] = useState<WorkView[]>(() => {
    const picked = new Set(initialPicked.map((w) => w.id));
    return [...initialPicked, ...pool.filter((w) => !picked.has(w.id)).slice(0, FIRST - initialPicked.length)];
  });
  const [picked, setPicked] = useState<string[]>(initialPicked.map((w) => w.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SavedTaste | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const pit = useBallPit();

  // full screen: the page behind must not scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const full = picked.length >= max;
  const remaining = Math.max(0, min - picked.length);
  const hasMore = pool.some((w) => !shown.some((s) => s.id === w.id));

  function toggle(id: string) {
    setError(null);
    if (picked.includes(id)) { pit.setSelected(id, false); setPicked(picked.filter((x) => x !== id)); return; }
    if (full) return;
    pit.setSelected(id, true);
    setPicked([...picked, id]);
  }

  function more() {
    const onScreen = new Set(shown.map((x) => x.id));
    setShown([...shown, ...pool.filter((x) => !onScreen.has(x.id)).slice(0, MORE)]);
  }

  /** A search pick drops into the pit from under the search box, already selected. */
  function pickFromSearch(w: WorkView) {
    if (!picked.includes(w.id) && full) { setError(`최대 ${max}개까지 고를 수 있어요.`); return; }
    const box = searchRef.current?.getBoundingClientRect();
    const field = pit.fieldRef.current?.getBoundingClientRect();
    const dropX = box && field ? box.left + box.width / 2 - field.left : undefined;
    if (shown.some((s) => s.id === w.id)) {
      pit.bump(w.id);
    } else {
      pit.queueSpawn(w.id, { x: dropX, selected: true });
      setShown((cur) => [...cur, w]);
    }
    if (!picked.includes(w.id)) { pit.setSelected(w.id, true); setPicked((cur) => [...cur, w.id]); }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/taste", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ workIds: picked }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Save failed");
      setResult(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboard" data-step={result ? "result" : "pick"} role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="onboard-top">
        <span className="wordmark" aria-hidden>Lecta</span>
        <Link className="btn-ghost" href={next}>{result ? "닫기" : "나중에 할게요"}</Link>
      </div>

      {result ? (
        <TasteResult result={result} count={picked.length} next={next} onRedo={() => setResult(null)} />
      ) : (
        <>
          <header className="onboard-head">
            <h1 id="onboard-title" className="h3">{userName ? `${userName}님, ` : ""}좋아하는 작품을 골라 주세요.</h1>
            <p className="muted">공을 누르거나, 찾는 작품을 검색해 담아 주세요. {min}개 이상이면 돼요.</p>
            <SearchBox boxRef={searchRef} picked={picked} onPick={pickFromSearch} />
          </header>

          <div className="pit" ref={pit.fieldRef} aria-label="Works">
            {shown.map((w) => (
              <button key={w.id} type="button" ref={(el) => pit.register(w.id, el)} className="ball" aria-pressed={picked.includes(w.id)}
                aria-label={`${w.title}, ${MEDIUM_KO[w.medium]}${picked.includes(w.id) ? ", 선택됨" : ""}`}
                onPointerDown={(e) => pit.grab(w.id, e)} onClick={() => { if (!pit.wasDragged()) toggle(w.id); }}>
                <span className="ball-art"><BallArt work={w} /></span>
                <span className="ball-label">{w.title}</span>
                <span className="ball-check" aria-hidden><Check size={17} strokeWidth={3} /></span>
              </button>
            ))}
          </div>

          <div className="onboard-bar">
            {hasMore && <button type="button" className="btn-ghost" onClick={more}>작품 더 떨어뜨리기</button>}
            <p aria-live="polite">
              {picked.length === 0 ? `${min}개 이상 골라 주세요` : remaining > 0 ? `${picked.length}개 · ${remaining}개 더` : full ? `${picked.length}개 · 최대 ${max}개` : `${picked.length}개 골랐어요`}
            </p>
            {error && <p className="notice error" role="alert" style={{ padding: "6px 12px" }}>{error}</p>}
            <button type="button" className="btn" disabled={remaining > 0 || saving} onClick={save}>{saving ? "취향을 읽는 중…" : "완료"}</button>
          </div>
        </>
      )}
    </div>
  );
}

function SearchBox({ boxRef, picked, onPick }: { boxRef: React.RefObject<HTMLDivElement | null>; picked: string[]; onPick: (w: WorkView) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<WorkView[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const composing = useRef(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/works?${new URLSearchParams({ q: term, limit: "8" })}`, { signal: ctl.signal });
        const body = await res.json();
        if (res.ok) { setHits(body.works); setActive(0); setOpen(true); }
      } catch { /* aborted or offline: keep the last results */ }
    }, composing.current ? 600 : 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const choose = (w: WorkView) => { onPick(w); setQ(""); setHits([]); setOpen(false); };

  return (
    <div className="onboard-search" ref={boxRef} role="search">
      <label className="search">
        <Search size={17} aria-hidden />
        <span className="sr-only">작품 검색</span>
        <input value={q} placeholder="작품이나 창작자 검색 — Aftersun, 이시구로" role="combobox" aria-expanded={open && hits.length > 0} aria-controls="onboard-hits"
          onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={(e) => {
            if (composing.current || !hits.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); choose(hits[active]); }
            if (e.key === "Escape") setOpen(false);
          }} />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search"><X size={16} /></button>}
      </label>
      {open && q.trim() && (
        <ul id="onboard-hits" className="onboard-hits" role="listbox">
          {hits.length === 0 ? <li className="muted" style={{ padding: "12px 16px" }}>“{q}”에 맞는 작품이 아직 없어요.</li> : hits.map((w, i) => (
            <li key={w.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(w)} onMouseEnter={() => setActive(i)}>
                <span className="hit-art"><BallArt work={w} /></span>
                <span><b>{w.title}</b><br /><small>{MEDIUM_KO[w.medium]} / {creatorName(w.creator)}{w.releaseYear ? `, ${w.releaseYear}` : ""}</small></span>
                {picked.includes(w.id) && <Check size={16} aria-label="선택됨" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BallArt({ work }: { work: CoverWork }) {
  const [failed, setFailed] = useState(false);
  if (!work.artwork || failed) return <WorkCover work={work} mini />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={work.artwork.url} alt="" draggable={false} loading="eager" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function TasteResult({ result, count, next, onRedo }: { result: SavedTaste; count: number; next: string; onRedo: () => void }) {
  const { profile, recommendations } = result;
  return (
    <section className="onboard-result" aria-live="polite">
      <p className="caption">{count}개의 작품에서 읽은 취향</p>
      {profile.tags.length > 0 ? (
        <p className="taste-tags">{profile.tags.map((t, i) => <span key={t.key} style={{ opacity: 1 - i * 0.12 }}>{t.label}</span>)}</p>
      ) : (
        <p className="h3">아직 태그가 붙지 않은 작품들이에요. 작품을 더 담을수록 취향이 또렷해져요.</p>
      )}
      {profile.media.length > 0 && <p className="muted">주로 {profile.media.map((m) => `${MEDIUM_KO[m.medium]} ${m.count}`).join(", ")}</p>}

      {recommendations.length > 0 && (
        <>
          <h2 className="h3" style={{ marginTop: 48 }}>이런 작품도 좋아하실 거예요</h2>
          <div className="onboard-recs">
            {recommendations.map((r) => (
              <Link key={r.workId} href={`/works/${r.workId}`} className="onboard-rec">
                <WorkImage work={{ id: r.workId, title: r.title, creator: r.creator, medium: r.medium, releaseYear: r.releaseYear, coverTone: r.coverTone, artwork: r.artwork }} />
                <span className="t-title">{r.title}</span>
                <span className="t-sub">{MEDIUM_KO[r.medium]} / {creatorName(r.creator)}{r.releaseYear ? `, ${r.releaseYear}` : ""}</span>
                {r.reasons[0] && <span className="t-sub">{r.reasons[0].text}</span>}
              </Link>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 32 }}>
        <Link className="btn" href={next}>시작하기</Link>
        <button type="button" className="text-btn" onClick={onRedo}>다시 고르기</button>
      </div>
    </section>
  );
}
