"use client";
import Link from "next/link";
import { useSelection } from "@/lib/selection";
import { WorkCover } from "./WorkCover";

export function SelectionShelf() {
  const { items, remove, clear } = useSelection();
  const n = items.length;
  return (
    <aside className="shelf" aria-label="Selection shelf" aria-live="polite">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p className="h3" style={{ margin: 0 }}>Selection</p>
        <span className="caption">{n} {n === 1 ? "work" : "works"}</span>
      </div>
      {n === 0 ? (
        <p className="muted" style={{ fontSize: 14, margin: "12px 0 0" }}>작품의 <b>Select</b>를 눌러 담아 보세요. 2개부터 전시를 시작할 수 있어요.</p>
      ) : (
        <ol>
          {items.map((w) => (
            <li key={w.id}>
              <div className="mini"><WorkCover work={w} mini /></div>
              <span><span className="serif" style={{ fontSize: 17 }}>{w.title}</span><br /><span className="muted" style={{ fontSize: 12.5 }}>{w.creator}</span></span>
              <button className="remove" onClick={() => remove(w.id)} aria-label={`Remove ${w.title} from the shelf`}>Remove</button>
            </li>
          ))}
        </ol>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: n ? 0 : 16 }}>
        {n >= 2 ? (
          <Link className="btn" href="/exhibitions/new">Begin exhibition with {n} works</Link>
        ) : (
          <span className="btn" aria-disabled="true">Begin exhibition{n === 1 ? " — add 1 more" : ""}</span>
        )}
        {n > 0 && <button className="remove" onClick={clear}>Clear</button>}
      </div>
    </aside>
  );
}
