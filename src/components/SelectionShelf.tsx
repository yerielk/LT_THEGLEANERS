"use client";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useSelection } from "@/lib/selection";
import { WorkImage } from "./WorkImage";

/** Floating selection tray — the works you are carrying to your new room. */
export function SelectionShelf({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
  const { items, remove, clear, ready } = useSelection();
  if (!ready) return null;
  const n = items.length;
  if (n === 0 && !alwaysVisible) return null;
  return (
    <aside className="tray" aria-label="Selection" aria-live="polite">
      {n === 0 ? (
        <span className="hint">작품의 + 를 눌러 담아 보세요. 담은 작품으로 큐레이션을 시작할 수 있어요.</span>
      ) : (
        <>
          <span className="thumbs">
            {items.map((w) => (
              <span key={w.id} className="thumb">
                <WorkImage work={w} mini />
                <button onClick={() => remove(w.id)} aria-label={`Remove ${w.title} from the shelf`}>×</button>
              </span>
            ))}
          </span>
          <span className="count">{n} {n === 1 ? "work" : "works"}</span>
          <button className="clear" onClick={clear}>Clear</button>
        </>
      )}
      {n >= 1 ? (
        <Link className="btn" href="/exhibitions/new">Curate {n} {n === 1 ? "work" : "works"}</Link>
      ) : (
        <Link className="btn" href="/exhibitions/new">Create a curation</Link>
      )}
    </aside>
  );
}

/** The tray follows the visitor across the site, so picked works stay in sight until they are curated. */
export function GlobalSelectionShelf() {
  const path = usePathname();
  if (/^\/exhibitions\/(new|[^/]+\/edit)$/.test(path) || path.startsWith("/welcome") || path.startsWith("/curation/")) return null;
  return <SelectionShelf alwaysVisible={path === "/discover"} />;
}
