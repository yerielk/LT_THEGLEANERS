"use client";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";
import type { CoverWork } from "@/components/WorkCover";
import { CurationCover, curationDisplayTitle } from "@/components/CurationCover";
import { CurationWorkShelf } from "@/components/CurationWorkShelf";
import type { Medium as WorkMedium } from "@/lib/media";

type Medium = "CURATION" | WorkMedium;

type CurationResult = { id: string; number: number; title: string; description: string | null; items?: { workId: string; work: CoverWork & { id: string } }[] };
type Item = CurationResult & { items: { workId: string; work: CoverWork & { id: string } }[] };
type Payload = { exhibitions: Item[] };
type WorkPreviewItem = { workId: string; work: CoverWork & { id: string } };

export function CurationWorkPreviews({ works, hrefForWork, ariaLabel = "Included works", className = "" }: {
  works: WorkPreviewItem[];
  hrefForWork: (workId: string) => string;
  ariaLabel?: string;
  className?: string;
}) {
  return <CurationWorkShelf items={works} hrefForWork={hrefForWork} ariaLabel={ariaLabel} className={`curation-search-works${className ? ` ${className}` : ""}`} />;
}

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object" || !Array.isArray((value as { exhibitions?: unknown }).exhibitions)) return false;
  return (value as { exhibitions: unknown[] }).exhibitions.every((entry) => !!entry && typeof entry === "object"
    && typeof (entry as Record<string, unknown>).id === "string"
    && typeof (entry as Record<string, unknown>).number === "number"
    && typeof (entry as Record<string, unknown>).title === "string"
    && Array.isArray((entry as Record<string, unknown>).items));
}

export function CurationSearchResults({ query, medium }: { query: string; medium: Medium }) {
  const [items, setItems] = useState<Item[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [resolvedQuery, setResolvedQuery] = useState("");
  useEffect(() => {
    const text = query.trim();
    if (!text) { setItems([]); setState("ready"); setResolvedQuery(""); return; }
    const controller = new AbortController();
    setItems([]);
    setState("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/exhibitions?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const body: unknown = await response.json();
        if (!response.ok || !isPayload(body)) throw new Error("Curation search failed");
        if (!controller.signal.aborted) { setItems(body.exhibitions); setState("ready"); setResolvedQuery(text); }
      } catch (error) {
        if ((error as Error).name !== "AbortError" && !controller.signal.aborted) { setState("error"); setResolvedQuery(text); }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  if (!query.trim()) return null;
  if (resolvedQuery !== query.trim()) return <section className="wrap curation-search-results" aria-live="polite" aria-label="Curation search results"><p className="muted">Searching curations…</p></section>;
  return <section className="wrap curation-search-results" aria-live="polite" aria-label="Curation search results">
    {state === "loading" ? <p className="muted">Searching curations…</p>
      : state === "error" ? <p className="notice error" role="alert">Curation search could not be loaded. Please try again.</p>
      : items.length === 0 ? <p className="muted">No curations match “{query.trim()}”.</p>
      : <CurationResultList items={items} medium={medium} query={query} />}
  </section>;
}

export function CurationResultList({ items, medium, query, showWorks = true }: {
  items: CurationResult[];
  medium: Medium;
  query?: string;
  showWorks?: boolean;
}) {
  const workHref = (id: string) => {
    const params = new URLSearchParams({ medium });
    if (query?.trim()) params.set("q", query.trim());
    return `/works/${id}?${params.toString()}`;
  };
  return <div className="curation-search-list">{items.map((item) => {
    const works = item.items ?? [];
    return <article className={`curation-search-card${showWorks ? "" : " curation-search-card-text-only"}`} key={item.id}>
      <Link className="curation-search-main" href={`/exhibitions/${item.id}`}>
        <CurationCover number={item.number} title={item.title} />
        <span className="curation-search-copy">
          <span className="curation-search-title">{curationDisplayTitle(item.title)}</span>
          {item.description && <span className="curation-search-description">{item.description}</span>}
        </span>
      </Link>
      {showWorks && <CurationWorkPreviews works={works} hrefForWork={workHref} />}
    </article>;
  })}</div>;
}
