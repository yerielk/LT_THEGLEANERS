"use client";
import { Link } from "next-view-transitions";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRecommendationSelection } from "@/lib/recommendation/selection";
import { CurationCover } from "@/components/CurationCover";
import type { Medium as WorkMedium } from "@/lib/media";

type Item = { id: string; number: number; title: string };
type RecommendationPayload = { recommendations: Item[] };
type Snapshot = { context: string; selectedIds: string[]; results: Item[]; newIds: string[] };
type Medium = "CURATION" | WorkMedium;

function isRecommendationPayload(value: unknown): value is RecommendationPayload {
  if (!value || typeof value !== "object" || !Array.isArray((value as { recommendations?: unknown }).recommendations)) return false;
  return (value as { recommendations: unknown[] }).recommendations.every((item) => !!item && typeof item === "object"
    && typeof (item as Record<string, unknown>).id === "string"
    && typeof (item as Record<string, unknown>).number === "number"
    && typeof (item as Record<string, unknown>).title === "string");
}

export function CurationRecommendations({ query, medium, gridRow, onVisibilityChange, matchQuery = query, selectedWorkId, detail = false }: {
  query: string;
  medium: Medium;
  gridRow?: number;
  onVisibilityChange?: (visible: boolean, context: string, selectedIds: string[]) => void;
  matchQuery?: string;
  selectedWorkId?: string;
  detail?: boolean;
}) {
  const { items, ready } = useRecommendationSelection(query, medium);
  const selectedIds = (selectedWorkId ? items.filter((work) => work.id === selectedWorkId) : items).map((work) => work.id);
  const ids = selectedIds.slice(-8).join(",");
  const context = JSON.stringify([medium, query.trim()]);
  const requestKey = JSON.stringify([context, matchQuery.trim(), selectedIds.join(","), ids]);
  const [snapshot, setSnapshot] = useState<Snapshot>({ context: "", selectedIds: [], results: [], newIds: [] });
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [scrollRequest, setScrollRequest] = useState(0);
  const completedScrollRequest = useRef(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    if (!detail || !selectedWorkId) return;
    const handleScrollRequest = (event: Event) => {
      const workId = (event as CustomEvent<{ workId?: string }>).detail?.workId;
      if (workId === selectedWorkId) setScrollRequest((request) => request + 1);
    };
    window.addEventListener("lecta-detail-recommendation-scroll", handleScrollRequest);
    return () => window.removeEventListener("lecta-detail-recommendation-scroll", handleScrollRequest);
  }, [detail, selectedWorkId]);

  useEffect(() => {
    const canRequest = ready && !!matchQuery.trim() && !!ids;
    const previous = snapshotRef.current;
    const sameContext = previous.context === context;
    const additive = canRequest && sameContext && previous.selectedIds.length > 0
      && previous.selectedIds.every((id) => selectedIds.includes(id))
      && selectedIds.length > previous.selectedIds.length;
    const retained = canRequest && sameContext ? previous.results : [];

    if (!canRequest) {
      setSnapshot({ context, selectedIds: [], results: [], newIds: [] });
      setState("idle");
      setErrorMessage("");
      onVisibilityChange?.(false, context, []);
      return;
    }

    setSnapshot({ context, selectedIds, results: retained, newIds: [] });
    setState("loading");
    setErrorMessage("");
    onVisibilityChange?.(retained.length > 0, context, retained.length ? selectedIds : []);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: matchQuery.trim() });
      ids.split(",").forEach((id) => params.append("workId", id));
      try {
        const response = await fetch(`/api/curation-recommendations?${params}`, { signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok) throw new Error("큐레이션 추천 요청에 실패했어요. 잠시 뒤 다시 시도해 주세요.");
        if (!isRecommendationPayload(body)) throw new Error("큐레이션 추천 응답을 읽지 못했어요.");
        if (controller.signal.aborted) return;
        const priorById = new Map(retained.map((item) => [item.id, item]));
        const ranked = body.recommendations.map((item) => priorById.get(item.id) ?? item);
        const rankedIds = new Set(ranked.map((item) => item.id));
        const merged = additive ? [...ranked, ...retained.filter((item) => !rankedIds.has(item.id))] : ranked;
        const newIds = merged.filter((item) => !priorById.has(item.id)).map((item) => item.id);
        setSnapshot({ context, selectedIds, results: merged, newIds });
        setState("idle");
        onVisibilityChange?.(merged.length > 0, context, merged.length ? selectedIds : []);
      } catch (error) {
        if ((error as Error).name !== "AbortError" && !controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : "큐레이션 추천 요청에 실패했어요.");
          setState("error");
          onVisibilityChange?.(retained.length > 0, context, retained.length ? selectedIds : []);
        }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  // requestKey represents every input that can change the recommendation request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, ready]);

  const visibleResults = snapshot.context === context ? snapshot.results : [];
  const snapshotMatchesSelection = snapshot.selectedIds.join(",") === selectedIds.join(",");
  const visible = ready && !!matchQuery.trim() && !!ids && snapshotMatchesSelection && visibleResults.length > 0;
  useLayoutEffect(() => {
    if (!detail || !visible || scrollRequest <= completedScrollRequest.current) return;
    completedScrollRequest.current = scrollRequest;
    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      const section = sectionRef.current;
      if (!section) return;
      const headerHeight = document.querySelector<HTMLElement>(".site-header")?.getBoundingClientRect().height ?? 72;
      const rect = section.getBoundingClientRect();
      const top = window.scrollY + rect.top - headerHeight - 16;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detail, scrollRequest, visible]);
  if (!visible && !(state === "error" && ready && matchQuery.trim() && ids)) return null;
  const newIds = new Set(snapshot.context === context ? snapshot.newIds : []);
  return <section ref={detail ? (element) => { sectionRef.current = element; } : undefined} className={`${detail ? "wrap " : ""}curation-inline${detail ? " curation-inline-detail" : ""}`} style={gridRow ? { gridRow } : undefined} aria-label="관련 큐레이션" aria-live="polite">
    {visible ? <>
      <span className="curation-inline-caption">이 작품이 포함된 추천 큐레이션</span>
      <div className="curation-inline-list">
        {visibleResults.map((item) => <Link className="curation-inline-item" data-entering={newIds.has(item.id) || undefined} href={`/exhibitions/${item.id}`} key={item.id}>
          <CurationCover number={item.number} title={item.title} />
        </Link>)}
      </div>
      {state === "error" && <span className="curation-inline-status error" role="alert">{errorMessage}</span>}
    </> : <span className="curation-inline-status error" role="alert">{errorMessage}</span>}
  </section>;
}
