"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "next-view-transitions";
import { CurationCover } from "@/components/CurationCover";
import { WorkImage } from "@/components/WorkImage";
import type { CoverWork } from "@/components/WorkCover";
import { CurationWorkPreviews } from "./CurationSearchResults";

type IncludedWork = { workId: string; work: CoverWork & { id: string } };
type PopularCuration = { id: string; number: number; title: string; description: string | null; ownerName: string; updatedAt: string; items: IncludedWork[] };
type Payload = { curations: PopularCuration[]; popularIds: string[]; suggestedIds: string[] };

function isPopular(value: unknown): value is PopularCuration {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.number !== "number" || typeof item.title !== "string" ||
      !(item.description === null || typeof item.description === "string") || typeof item.ownerName !== "string" ||
      typeof item.updatedAt !== "string" || !Array.isArray(item.items)) return false;
  return item.items.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const link = entry as Record<string, unknown>;
    if (typeof link.workId !== "string" || !link.work || typeof link.work !== "object") return false;
    const work = link.work as Record<string, unknown>;
    return typeof work.id === "string" && typeof work.title === "string" && typeof work.creator === "string" &&
      typeof work.medium === "string" && (typeof work.coverTone === "string" || work.coverTone === null);
  });
}

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.curations) && data.curations.every(isPopular) &&
    Array.isArray(data.popularIds) && data.popularIds.every((id) => typeof id === "string") &&
    Array.isArray(data.suggestedIds) && data.suggestedIds.every((id) => typeof id === "string");
}

function PopularCurationCard({ item, expanded, hoverSupported, listLayout, onToggle, onEnter, onLeave, cardRef }: {
  item: PopularCuration;
  expanded: boolean;
  hoverSupported: boolean;
  listLayout: boolean;
  onToggle: () => void;
  onEnter: () => void;
  onLeave: () => void;
  cardRef: (element: HTMLElement | null) => void;
}) {
  const date = new Date(item.updatedAt);
  const formattedDate = Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  const face = <CurationCover number={item.number} title={item.title} className="curation-popular-cover" />;
  const previewEvents = {
    onMouseEnter: hoverSupported && item.items.length ? onEnter : undefined,
    onFocus: hoverSupported && item.items.length ? onEnter : undefined,
  };

  return <article
    ref={cardRef}
    className={`curation-popular-item${expanded ? " is-expanded" : ""}${listLayout ? " curation-search-card is-row-layout" : ""}`}
    onMouseLeave={hoverSupported && item.items.length ? onLeave : undefined}
  >
    <div className={`curation-popular-summary${listLayout ? " curation-search-main" : ""}`}>
      {hoverSupported || listLayout
        ? <Link className="curation-popular-face" href={`/exhibitions/${item.id}`} {...previewEvents}>{face}</Link>
        : <button className="curation-popular-face" type="button" aria-expanded={expanded} onClick={onToggle}>{face}</button>}
      <div className="curation-popular-caption">
        {listLayout && item.description && <span className="curation-search-description curation-popular-description">{item.description}</span>}
        {item.ownerName !== "unknown" && <span className="curation-popular-owner">Curated by {item.ownerName}</span>}
        <span className="curation-popular-meta">{item.items.length} works{formattedDate && <span>{formattedDate}</span>}</span>
      </div>
    </div>
    {listLayout && item.items.length > 0 && <CurationWorkPreviews
      works={item.items}
      hrefForWork={(workId) => `/works/${workId}`}
      ariaLabel="Included works"
    />}
  </article>;
}

function CurationRow({ title, items, onMore, moreLabel = "더보기", hoverSupported = false, listLayout = false }: {
  title: string;
  items: PopularCuration[];
  onMore?: () => void;
  moreLabel?: string;
  hoverSupported?: boolean;
  listLayout?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const worksRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setExpandedId(null), 180);
  };
  const showItem = (id: string) => {
    clearCloseTimer();
    setExpandedId(id);
  };
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const expandedIndex = items.findIndex((item) => item.id === expandedId);
  const expandedItem = items[expandedIndex] ?? null;

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const panel = worksRef.current;
    const card = expandedId ? cardRefs.current.get(expandedId) : null;
    if (!shell || !panel || !card) return;

    const alignPanel = () => {
      panel.style.transform = "translateX(0px)";
      const panelRect = panel.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const visibleLeft = shellRect.left + shell.clientLeft;
      const visibleRight = visibleLeft + shell.clientWidth;
      const visibleWidth = shell.clientWidth;
      const cardCenter = cardRect.left + cardRect.width / 2;
      let targetLeft = cardCenter - panelRect.width / 2;

      if (panelRect.width > visibleWidth) {
        targetLeft = visibleLeft;
      } else {
        if (cardCenter < visibleLeft + visibleWidth * 0.34) targetLeft = cardRect.left;
        else if (cardCenter > visibleLeft + visibleWidth * 0.66) targetLeft = cardRect.right - panelRect.width;
        targetLeft = Math.max(visibleLeft, Math.min(targetLeft, visibleRight - panelRect.width));
      }
      panel.style.transform = `translateX(${targetLeft - panelRect.left}px)`;
    };

    alignPanel();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(alignPanel);
    observer?.observe(shell);
    observer?.observe(panel);
    observer?.observe(card);
    shell.addEventListener("scroll", alignPanel, { passive: true });
    window.addEventListener("resize", alignPanel);
    return () => {
      observer?.disconnect();
      shell.removeEventListener("scroll", alignPanel);
      window.removeEventListener("resize", alignPanel);
    };
  }, [expandedId, items]);

  if (!items.length) return null;
  const columns = listLayout ? 1 : 4;
  const itemRows = Array.from({ length: Math.ceil(items.length / columns) }, (_, index) =>
    items.slice(index * columns, index * columns + columns));

  return <section className="curation-discovery-row" aria-label={title}>
    <div className="curation-discovery-heading">
      <h2 className="curation-discovery-title">{title}</h2>
      {onMore && <button type="button" className="curation-discovery-more" onClick={onMore}>{moreLabel}</button>}
    </div>
    <div className="curation-popular-shell" ref={shellRef}>
      <div className="curation-popular-content">
        <div className={`curation-popular-list${listLayout ? " is-expanded-list" : ""}`}>
          {itemRows.map((rowItems, rowIndex) => {
            const rowExpandedIndex = expandedIndex - rowIndex * columns;
            const rowExpandedItem = rowExpandedIndex >= 0 && rowExpandedIndex < rowItems.length ? expandedItem : null;
            return <div className={`curation-popular-grid${listLayout ? " is-expanded-list" : ""}`} key={rowIndex}>
              {rowItems.map((item) => <PopularCurationCard
                item={item}
                key={item.id}
                expanded={expandedId === item.id}
                hoverSupported={hoverSupported}
                listLayout={listLayout}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onEnter={() => showItem(item.id)}
                onLeave={scheduleClose}
                cardRef={(element) => {
                  if (element) cardRefs.current.set(item.id, element);
                  else cardRefs.current.delete(item.id);
                }}
              />)}
              {!listLayout && <div
                className={`curation-popular-details${rowExpandedItem ? ` is-open at-${rowExpandedIndex + 1}` : ""}`}
                aria-hidden={!rowExpandedItem}
              >
                <div className={`curation-popular-details-inner`}>
      {rowExpandedItem &&
                    <div
                      className="curation-popular-works"
                      aria-label="수록 작품"
                      ref={worksRef}
                      style={{ gridColumn: rowExpandedIndex + 1, justifySelf: "center", transform: "translateX(0px)" }}
                      onMouseEnter={hoverSupported ? clearCloseTimer : undefined}
                      onMouseLeave={hoverSupported ? scheduleClose : undefined}
                    >
                      {rowExpandedItem.items.map(({ workId, work }) => <Link className="curation-popular-work" href={`/works/${workId}`} key={workId} aria-label={`${work.title} 작품 보기`}>
                        <span className="curation-work-art"><WorkImage work={work} /></span>
                        <span>{work.title}</span>
                      </Link>)}
                    </div>}
                </div>
              </div>}
            </div>;
          })}
        </div>
      </div>
    </div>
  </section>;
}

export function CurationDiscovery({ active }: { active: boolean }) {
  const requested = useRef(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hoverSupported, setHoverSupported] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHoverSupported(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    void fetch("/api/curation-discovery")
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isPayload(body)) throw new Error("Unable to load curation discovery");
        setPayload(body);
      })
      .catch(() => setPayload({ curations: [], popularIds: [], suggestedIds: [] }));
  }, [active]);

  if (!active || !payload) return null;
  const curationById = new Map(payload.curations.map((item) => [item.id, item]));
  const popularItems = payload.popularIds.map((id) => curationById.get(id)).filter((item): item is PopularCuration => !!item);
  const suggestedItems = payload.suggestedIds.map((id) => curationById.get(id)).filter((item): item is PopularCuration => !!item);
  return <div className="wrap curation-discovery">
    <CurationRow title="인기 큐레이션" items={expanded ? popularItems : popularItems.slice(0, 4)} onMore={() => setExpanded((value) => !value)}
      moreLabel={expanded ? "접기" : "더보기"} hoverSupported={hoverSupported} listLayout={expanded} />
    <CurationRow title="이런 큐레이션은 어때요?" items={suggestedItems.slice(0, 12)} hoverSupported={hoverSupported} />
  </div>;
}
