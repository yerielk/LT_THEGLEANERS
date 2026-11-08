"use client";
import { Link } from "next-view-transitions";
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
        <span className="hint">작품의 + 를 눌러 담아 보세요. 2개부터 전시를 만들 수 있어요.</span>
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
      {n >= 2 ? (
        <Link className="btn" href="/exhibitions/new">Begin exhibition with {n} works</Link>
      ) : (
        <span className="btn" aria-disabled="true">Begin exhibition</span>
      )}
    </aside>
  );
}
