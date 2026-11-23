"use client";
import { useState } from "react";

/** The shelf's name is edited in place and saved when the field loses focus. */
export function ShelfName({ id, name }: { id: string; name: string }) {
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(name);
  const [status, setStatus] = useState("");

  async function commit() {
    const next = value.trim();
    if (!next) { setValue(saved); return; }
    if (next === saved) return;
    const res = await fetch(`/api/me/collections/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: next }) });
    if (res.ok) { setSaved(next); setValue(next); setStatus("이름을 바꿨어요"); }
    else { setValue(saved); setStatus("이름을 바꾸지 못했어요"); }
    setTimeout(() => setStatus(""), 2400);
  }

  return (
    <>
      <input className="shelf-name" value={value} maxLength={40} aria-label="보관함 이름" size={Math.max(6, value.length + 1)}
        onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      <span className="caption" role="status">{status || "이름을 눌러 바꿀 수 있어요"}</span>
    </>
  );
}
