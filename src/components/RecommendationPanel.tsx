"use client";
import { Link } from "next-view-transitions";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecommendationResult, Recommendation } from "@/lib/recommendation/engine";
import { MEDIUM_LABEL } from "./WorkCover";
import { WorkImage } from "./WorkImage";

const REASONS = [
  { key: "lingering_emotion", ko: "오래 남는 여운" },
  { key: "restrained_expression", ko: "절제된 표현" },
  { key: "atmosphere", ko: "분위기" },
  { key: "nuanced_characters", ko: "입체적인 인물" },
  { key: "poetic_prose", ko: "시적인 문장" },
  { key: "sonic_texture", ko: "소리의 질감" },
];
const MEDIA = ["ANY", "FILM", "SERIES", "BOOK", "ALBUM"] as const;
const PARTS: [keyof Recommendation["scoreBreakdown"], string][] = [["semantic", "맥락"], ["why", "이유"], ["theme", "주제"], ["diversity", "다양성"], ["discovery", "확장"]];

type Rec = Recommendation & { artwork?: { url: string; width: number; height: number } | null };

export function RecommendationPanel({ exhibitionId, canAdd }: { exhibitionId: string; canAdd: boolean }) {
  const router = useRouter();
  const [reasons, setReasons] = useState<string[]>([]);
  const [medium, setMedium] = useState<(typeof MEDIA)[number]>("ANY");
  const [data, setData] = useState<(RecommendationResult & { recommendations: Rec[] }) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const run = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ exhibitionId, limit: 3, likedReasons: reasons.length ? reasons : undefined, targetMedium: medium === "ANY" ? undefined : medium }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Recommendation failed");
      setData(body); setState("ready");
    } catch (e) { setError((e as Error).message); setState("error"); }
  }, [exhibitionId, reasons, medium]);

  useEffect(() => { run(); }, [run]);

  async function add(r: Recommendation) {
    setAdding(r.workId);
    try {
      const res = await fetch(`/api/exhibitions/${exhibitionId}/items`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ workId: r.workId, fromRecommendation: true, score: r.score }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not add");
      setAdded(r.title);
      router.refresh();
      await run();
    } catch (e) { setError((e as Error).message); setState("error"); }
    finally { setAdding(null); }
  }

  return (
    <section className="recs" aria-labelledby="recs-title">
      <div className="recs-head">
        <div>
          <h2 id="recs-title" className="h2">A piece that belongs here</h2>
          <p className="muted" style={{ margin: "10px 0 0", maxWidth: "36em" }}>이 방의 작품, 제목과 소개, 그리고 고른 이유를 읽고 컬렉션에서 다음 작품을 찾아요.</p>
        </div>
        <button className="btn" onClick={run} disabled={state === "loading"}>{state === "loading" ? "Finding…" : "Find another piece"}</button>
      </div>
      <div className="recs-controls">
        <div className="toggles" role="group" aria-label="What do you love about these works?">
          <span className="label-k">Why you love them</span>
          {REASONS.map((r) => (
            <button key={r.key} className="toggle" aria-pressed={reasons.includes(r.key)} onClick={() => setReasons((cur) => cur.includes(r.key) ? cur.filter((x) => x !== r.key) : [...cur, r.key])}>{r.ko}</button>
          ))}
        </div>
        <div className="toggles" role="group" aria-label="Medium">
          <span className="label-k">Medium</span>
          {MEDIA.map((m) => <button key={m} className="toggle" aria-pressed={medium === m} onClick={() => setMedium(m)}>{m === "ANY" ? "Any" : MEDIUM_LABEL[m]}</button>)}
        </div>
      </div>
      {added && <p className="notice" role="status" style={{ marginTop: 24 }}>「{added}」을(를) 이 방에 추가했어요.</p>}
      {state === "error" && <p className="notice error" role="alert" style={{ marginTop: 24 }}>{error} <button className="text-btn" onClick={run}>Retry</button></p>}
      {data && data.recommendations.length === 0 && state === "ready" && <p className="notice" style={{ marginTop: 24 }}>이 조건에 남은 작품이 없어요. 매체를 Any로 바꿔 보세요.</p>}
      {data && (
        <div className="rec-grid" style={{ opacity: state === "loading" ? 0.5 : 1, transition: "opacity .25s" }} aria-busy={state === "loading"}>
          {data.recommendations.map((r) => (
            <article key={r.workId} className="rec-card">
              <Link href={`/works/${r.workId}`} aria-label={`${r.title}, details`}><WorkImage work={r} /></Link>
              <div>
                <span className={`badge ${r.confidenceLabel === "editorially_matched" ? "on" : "off"}`}>{r.confidenceLabel === "editorially_matched" ? "Matched" : "Exploratory"}</span>
                <span className="caption"> / {MEDIUM_LABEL[r.medium]} / score {r.score.toFixed(2)}</span>
                <Link href={`/works/${r.workId}`} className="serif" style={{ fontSize: 26, lineHeight: 1.1, display: "block", marginTop: 6, fontStyle: "italic" }}>{r.title}</Link>
                <div className="muted" style={{ fontSize: 13 }}>{r.creator}{r.releaseYear ? `, ${r.releaseYear}` : ""}</div>
                <ul className="reasons">{r.reasons.map((x, i) => <li key={i}>{x.text}</li>)}</ul>
                <div className="score-bar" aria-label={PARTS.map(([k, l]) => `${l} ${r.scoreBreakdown[k] ?? "n/a"}`).join(", ")}>
                  {PARTS.map(([k]) => <span key={k}><i style={{ width: `${Math.round((r.scoreBreakdown[k] ?? 0) * 100)}%`, opacity: r.scoreBreakdown[k] === null ? 0 : 1 }} /></span>)}
                </div>
                <div className="score-labels">{PARTS.map(([k, l]) => <span key={k}>{l}</span>)}</div>
                {canAdd && (
                  <button className="btn btn-sm" style={{ marginTop: 16 }} disabled={adding !== null} onClick={() => add(r)}>
                    {adding === r.workId ? "Adding…" : "Add to exhibition"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {data && <p className="caption" style={{ marginTop: 32 }}>{data.algorithmVersion}{data.fallbackUsed ? " / fallback: no shared tags found" : ""}{data.appliedReasons.length ? ` / reasons: ${data.appliedReasons.map((a) => a.label).join(", ")}` : ""}</p>}
    </section>
  );
}
