"use client";
import { useState } from "react";
import { Bookmark, Heart } from "lucide-react";

type State = { liked: boolean; saved: boolean; likes: number; canReact: boolean };

/** Like and save buttons for a work or a curation. A like feeds taste; a save keeps it on the person's shelf. */
export function Reactions({ targetType, targetId, initial }: { targetType: "WORK" | "CURATION"; targetId: string; initial: State }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<"like" | "save" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send(kind: "like" | "save") {
    if (!state.canReact) { setNote("로그인하면 좋아요와 저장을 쓸 수 있어요."); return; }
    setBusy(kind);
    setNote(null);
    try {
      const res = await fetch(kind === "like" ? "/api/me/likes" : "/api/me/saves", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetType, targetId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "failed");
      if (kind === "like") setState((s) => ({ ...s, liked: body.liked, likes: body.likes }));
      else { setState((s) => ({ ...s, saved: body.saved })); setNote(body.saved ? `${body.shelf.name}에 담았어요.` : `${body.shelf.name}에서 뺐어요.`); }
    } catch {
      setNote("지금은 반영하지 못했어요. 잠시 후 다시 눌러 주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="reactions">
      <button type="button" className="reaction" aria-pressed={state.liked} disabled={busy === "like"} onClick={() => send("like")} aria-label={state.liked ? "좋아요 취소" : "좋아요"}>
        <Heart size={16} aria-hidden />{state.likes > 0 ? state.likes : "Like"}
      </button>
      <button type="button" className="reaction" aria-pressed={state.saved} disabled={busy === "save"} onClick={() => send("save")} aria-label={state.saved ? "저장 취소" : "저장"}>
        <Bookmark size={16} aria-hidden />{state.saved ? "Saved" : "Save"}
      </button>
      {note && <span className="reaction-note" role="status">{note}</span>}
    </span>
  );
}
