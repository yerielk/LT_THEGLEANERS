"use client";
import { Link, useTransitionRouter } from "next-view-transitions";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { useSelection, type SelectedWork } from "@/lib/selection";
import { WorkImage } from "./WorkImage";
import { MEDIUM_KO } from "./WorkCover";
import { wallFor } from "@/lib/design";

const DRAFT_KEY = "lecta.builder.v1";

interface Draft { title: string; description: string; notes: Record<string, string>; order: string[]; requestId: string }

function loadDraft(): Draft | null {
  try { const raw = sessionStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveDraft(d: Draft) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ } }
function clearDraft() { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }

type EditInit = { id: string; number: number; version: number; title: string; description: string; items: (SelectedWork & { note: string })[] };

export function ExhibitionEditor({ mode, init, canWrite }: { mode: "new" | "edit"; init?: EditInit; canWrite: boolean }) {
  const router = useTransitionRouter();
  const selection = useSelection();
  const [title, setTitle] = useState(init?.title ?? "");
  const [description, setDescription] = useState(init?.description ?? "");
  const [notes, setNotes] = useState<Record<string, string>>(Object.fromEntries((init?.items ?? []).map((i) => [i.id, i.note])));
  const [order, setOrder] = useState<string[]>((init?.items ?? []).map((i) => i.id));
  const [editItems] = useState<SelectedWork[]>(init?.items ?? []);
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const hydrated = useRef(false);

  // new mode: restore the in-progress form after a refresh
  useEffect(() => {
    if (mode !== "new" || hydrated.current || !selection.ready) return;
    hydrated.current = true;
    const d = loadDraft();
    if (d) { setTitle(d.title); setDescription(d.description); setNotes(d.notes); setOrder(d.order); setRequestId(d.requestId); }
    else setRequestId(`web-${crypto.randomUUID()}`);
  }, [mode, selection.ready]);

  const pool = mode === "new" ? selection.items : editItems;
  const items = useMemo(() => {
    const byId = new Map(pool.map((w) => [w.id, w]));
    const ordered = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    const rest = pool.filter((w) => !order.includes(w.id));
    return [...ordered, ...rest];
  }, [pool, order]);

  useEffect(() => {
    if (mode === "new" && hydrated.current && requestId) saveDraft({ title, description, notes, order: items.map((i) => i.id), requestId });
  }, [mode, title, description, notes, items, requestId]);

  const move = (idx: number, dir: -1 | 1) => {
    const ids = items.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setOrder(ids);
  };
  const removeItem = (id: string) => {
    if (mode === "new") selection.remove(id);
    setOrder(items.map((i) => i.id).filter((x) => x !== id));
  };

  const roomNo = mode === "edit" ? init!.number : 0;
  const wall = wallFor(mode === "edit" ? init!.number : 5);
  const titleMissing = title.trim().length === 0;
  const tooFew = items.length < 2;
  const tooMany = mode === "new" && items.length > 8;

  async function save() {
    setTouched(true);
    setError(null);
    if (titleMissing || tooFew || tooMany || saving) return;
    setSaving(true);
    try {
      const res = mode === "new"
        ? await fetch("/api/exhibitions", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title, description: description || undefined, requestId,
              workIds: items.map((i) => i.id),
              curatorNotes: items.filter((i) => notes[i.id]?.trim()).map((i) => ({ workId: i.id, note: notes[i.id].trim() })),
            }),
          })
        : await fetch(`/api/exhibitions/${init!.id}`, {
            method: "PATCH", headers: { "content-type": "application/json" },
            body: JSON.stringify({ title, description, expectedVersion: init!.version, items: items.map((i) => ({ workId: i.id, curatorNote: notes[i.id]?.trim() || undefined })) }),
          });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? `Save failed (${res.status})`);
      const id = body.exhibition.id as string;
      if (mode === "new") { clearDraft(); selection.clear(); }
      router.push(`/exhibitions/${id}?saved=1`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  if (mode === "new" && selection.ready && items.length === 0) {
    return (
      <div className="wrap" style={{ paddingBlock: "48px 120px" }}>
        <h1 className="display">Begin an exhibition.</h1>
        <p className="lede">아직 선반이 비어 있어요. Discover에서 작품 2개 이상을 골라 오면 여기서 전시로 엮을 수 있어요.</p>
        <Link className="btn" href="/discover">Choose works in Discover</Link>
      </div>
    );
  }

  return (
    <div className="wrap builder">
      <form className="builder-form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div>
          <p className="caption">{mode === "new" ? "New exhibition" : "Edit exhibition"}</p>
          <div className="step-label"><span className="n">1</span><span className="caption">Title and introduction</span></div>
          <label className="field">
            <span className="sr-only">Exhibition title (required)</span>
            <input className="input input-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Longing & Other Quiet Things"
              aria-invalid={touched && titleMissing} aria-describedby="title-err" />
          </label>
          {touched && titleMissing && <p id="title-err" className="error-text">전시 제목을 입력해 주세요.</p>}
          <label className="field" style={{ marginTop: 18 }}>
            <span className="caption">Introduction (optional)</span>
            <textarea className="textarea" rows={3} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이 전시를 한두 문장으로 소개해 주세요. 추천이 이 문장을 읽습니다." />
          </label>
        </div>

        <div>
          <div className="step-label"><span className="n">2</span><span className="caption">Works and order — {items.length} selected</span></div>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((w, i) => (
              <li key={w.id} className="item-row">
                <span className="thumb"><WorkImage work={w} /></span>
                <div>
                  <div className="serif" style={{ fontSize: 22, lineHeight: 1.15, fontStyle: "italic" }}>{w.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{MEDIUM_KO[w.medium]} / {w.creator}</div>
                  <label className="field" style={{ marginTop: 8, gap: 4 }}>
                    <span className="sr-only">Why this work belongs (optional)</span>
                    <input className="input" style={{ padding: "8px 10px", fontSize: 14 }} maxLength={200} value={notes[w.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))} placeholder="왜 이 작품인가요? 한 줄이면 충분해요" />
                  </label>
                </div>
                <div className="controls">
                  <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${w.title} up`}><ArrowUp size={15} /></button>
                  <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${w.title} down`}><ArrowDown size={15} /></button>
                  <button type="button" className="icon-btn" onClick={() => removeItem(w.id)} disabled={mode === "edit" && items.length <= 1} aria-label={`Remove ${w.title}`}><X size={15} /></button>
                </div>
              </li>
            ))}
          </ol>
          {touched && tooFew && <p className="error-text">전시에는 작품이 2개 이상 필요해요.</p>}
          {tooMany && <p className="error-text">처음 만들 때는 8개까지 담을 수 있어요. 저장한 뒤 추천으로 더 추가할 수 있어요.</p>}
          {mode === "new" && <p style={{ marginTop: 14 }}><Link className="btn-ghost" href="/discover">Add more works</Link></p>}
        </div>

        <div>
          <div className="step-label"><span className="n">3</span><span className="caption">Save</span></div>
          {!canWrite && <p className="notice error">카카오로 로그인하면 전시를 저장할 수 있어요. 로컬 UAT에서는 <code>DEMO_MODE=true</code>로도 저장할 수 있어요.</p>}
          {error && <p className="notice error" role="alert">{error}</p>}
          <div className="save-bar">
            <button type="submit" className="btn" disabled={saving || !canWrite}>{saving ? "Saving…" : mode === "new" ? "Save draft" : "Save changes"}</button>
            <span className="muted" style={{ fontSize: 13 }}>{mode === "new" ? "비공개 초안으로 저장돼요. 저장 후 전시 페이지로 이동합니다." : `version ${init!.version}`}</span>
          </div>
        </div>
      </form>

      <section className="preview-pane" aria-label="Live preview" style={{ "--room": wall.hex, "--room-ink": wall.ink } as CSSProperties}>
        <p className="caption" style={{ margin: 0 }}>Live preview — your room, wall colour {wall.name}</p>
        <div className="preview-wall">
          <div className="p-panel">
            <span style={{ fontSize: 11 }}>Room {String(roomNo).padStart(2, "0")}</span>
            <span className="t">{title || "Untitled"}</span>
            <span style={{ fontSize: 11, opacity: .85 }}>{items.length} works</span>
          </div>
          {items.map((w, i) => (
            <figure key={w.id} className="hung" data-medium={w.medium} style={{ margin: 0, "--ar": w.artwork ? w.artwork.width / w.artwork.height : 0.66 } as CSSProperties}>
              <WorkImage work={w} />
              <figcaption className="label" style={{ minHeight: 0, maxWidth: 180 }}>
                <span className="l-title" style={{ fontSize: 16 }}>{String(i + 1).padStart(2, "0")} {w.title}</span>
                {notes[w.id]?.trim() && <span className="l-line" style={{ color: "var(--ink)", fontFamily: "var(--kserif)" }}>“{notes[w.id].trim()}”</span>}
              </figcaption>
            </figure>
          ))}
        </div>
        {description && <p className="muted" style={{ fontSize: 14, maxWidth: "36em" }}>{description}</p>}
      </section>
    </div>
  );
}
