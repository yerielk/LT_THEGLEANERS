"use client";
import { useEffect, useState } from "react";
import type { WorkView } from "@/lib/services/works";
import { SOURCE_POLICY, type ExternalSource, type ExternalWork } from "@/lib/external/types";
import { MEDIUM_KO } from "@/components/WorkCover";
import { WorkImage } from "@/components/WorkImage";
import { useSelection } from "@/lib/selection";

const SOURCE_LABEL: Record<ExternalSource, string> = {
  TMDB: "TMDB", ALADIN: "알라딘", KAKAO_BOOK: "Kakao 책", MUSICBRAINZ: "MusicBrainz", KOPIS: "KOPIS", CULTURE_PORTAL: "문화포털", SEOUL_CULTURE: "서울문화포털", WIKIDATA: "Wikidata",
};
const keyOf = (w: ExternalWork) => `${w.source}:${w.externalId}`;
const square = (m: ExternalWork["medium"]) => m === "ALBUM" || m === "TRACK";

/**
 * Works found outside our catalog for the current search. Nothing here is stored until the visitor presses +,
 * which saves the work into the catalog and puts it on the selection shelf.
 */
export function ExternalResults({ q, medium, onSaved }: { q: string; medium: string; onSaved: (work: WorkView) => void }) {
  const [items, setItems] = useState<ExternalWork[]>([]);
  const [failed, setFailed] = useState<ExternalSource[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { add } = useSelection();
  const text = q.trim();

  useEffect(() => {
    setItems([]);
    setFailed([]);
    setSaveError(null);
    if (text.length < 2) { setState("idle"); return; }
    setState("loading");
    const ctl = new AbortController();
    // slower than the catalog search: every call here spends the sources' quotas
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ q: text, limit: "6" });
      if (medium !== "ALL") sp.set("medium", medium);
      try {
        const res = await fetch(`/api/external/search?${sp}`, { signal: ctl.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Search failed");
        setItems(body.works);
        setFailed(body.failedSources.map((f: { source: ExternalSource }) => f.source));
        setState("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 900);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text, medium]);

  async function save(w: ExternalWork) {
    setSaving(keyOf(w));
    setSaveError(null);
    try {
      const res = await fetch("/api/external/works", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: w.source, externalId: w.externalId, medium: w.medium, title: w.title }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(res.status === 401 ? "작품을 담으려면 먼저 로그인해 주세요." : (body?.error?.message ?? "Save failed"));
      const saved: WorkView = body.work;
      add({ id: saved.id, title: saved.title, originalTitle: saved.originalTitle, creator: saved.creator, medium: saved.medium, releaseYear: saved.releaseYear, coverTone: saved.coverTone, artwork: saved.artwork });
      onSaved(saved);
      setItems((cur) => cur.filter((x) => keyOf(x) !== keyOf(w)));
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (text.length < 2) return null;
  const attributions = [...new Set(items.map((w) => SOURCE_POLICY[w.source].attribution))];
  return (
    <section className="wrap external" aria-label="Works outside Lecta">
      <div className="external-head">
        <h2 className="h3">Lecta 밖에서 찾은 작품</h2>
        <p className="muted" aria-live="polite">
          {state === "loading" ? "외부 카탈로그에서 찾는 중…" : state === "error" ? "외부 검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." : items.length === 0 ? `“${text}”에 맞는 작품을 외부에서도 찾지 못했어요.` : "+ 를 누르면 Lecta에 추가되고 내 선택에 담겨요."}
        </p>
        {saveError && <p className="notice error" role="alert">{saveError}</p>}
      </div>
      {items.length > 0 && (
        <div className="catalog external-grid">
          {items.map((w) => (
            <article key={keyOf(w)} className="tile" data-medium={w.medium}>
              <WorkImage work={{ title: w.title, originalTitle: w.originalTitle, creator: w.creator, medium: w.medium, releaseYear: w.releaseYear, artwork: w.artwork ? { url: w.artwork.url, width: 300, height: square(w.medium) ? 300 : 450 } : null }} />
              <div className="meta">
                <div>
                  <div className="t-title">{w.title}</div>
                  <div className="t-sub">{[MEDIUM_KO[w.medium], w.creator, w.releaseYear].filter(Boolean).join(" / ")}</div>
                  {w.event && <div className="t-sub">{[w.event.venue, w.event.startDate].filter(Boolean).join(", ")}</div>}
                </div>
                <button type="button" className="select-toggle" disabled={saving !== null} onClick={() => save(w)} aria-label={`Add ${w.title} to Lecta and to selection`}>
                  {saving === keyOf(w) ? "…" : "+"}
                </button>
              </div>
              <div className="tags">{w.sourceUrl ? <a href={w.sourceUrl} target="_blank" rel="noreferrer">{SOURCE_LABEL[w.source]}</a> : SOURCE_LABEL[w.source]}</div>
            </article>
          ))}
        </div>
      )}
      {(attributions.length > 0 || failed.length > 0) && (
        <p className="external-credit">
          {attributions.map((a) => <span key={a}>{a}</span>)}
          {failed.length > 0 && <span>지금 응답하지 않는 곳: {failed.map((s) => SOURCE_LABEL[s]).join(", ")}</span>}
        </p>
      )}
    </section>
  );
}
