"use client";
import { useState } from "react";

export function CopyLink({ isDraft }: { isDraft: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button className="btn btn-sm btn-ghost" onClick={async () => {
      try { await navigator.clipboard.writeText(window.location.href.split("?")[0]); setState("copied"); } catch { setState("failed"); }
      setTimeout(() => setState("idle"), 2200);
    }} title={isDraft ? "Private draft: only you can open this link" : undefined}>
      {state === "copied" ? (isDraft ? "Copied (private)" : "Link copied") : state === "failed" ? "Copy failed" : "Copy link"}
    </button>
  );
}
