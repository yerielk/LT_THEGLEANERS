"use client";
import { useTransitionRouter } from "next-view-transitions";

const TABS = [
  { key: "works", href: "/discover", label: "작품 검색" },
  { key: "curations", href: "/curations", label: "큐레이션 검색" },
] as const;

/**
 * Switch between work search and curation search, carrying the current search term across.
 * The term is read from the address bar at click time, since both pages keep it there as `?q=`.
 */
export function SearchTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  const router = useTransitionRouter();
  return (
    <nav className="search-tabs" aria-label="검색 종류">
      {TABS.map((t) => (
        <a key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            if (t.key === active) return;
            const q = new URL(window.location.href).searchParams.get("q");
            router.push(q ? `${t.href}?q=${encodeURIComponent(q)}` : t.href);
          }}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
