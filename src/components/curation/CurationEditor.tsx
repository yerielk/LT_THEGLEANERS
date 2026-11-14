"use client";

import { useEffect, useRef } from "react";
import { Link } from "next-view-transitions";
import { AuthButton } from "../AuthButton";
import { useSelection } from "@/lib/selection";
import { curationWork } from "@/lib/curation/view";
import type { CurationDocument } from "@/lib/curation/document";

export function CurationEditor({ initial, id, version, canWrite, curator = "" }: {
  initial?: CurationDocument; id?: string; version?: number; canWrite: boolean; curator?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const selection = useSelection();
  const ready = useRef(false);
  const initialized = useRef(false);
  const current = useRef({ initial, id, version, curator, selection });
  current.current = { initial, id, version, curator, selection };

  useEffect(() => {
    function initialize() {
      const props = current.current;
      if (!ready.current || initialized.current || (!props.initial && !props.selection.ready)) return;
      initialized.current = true;
      const document = props.initial ?? { title: "", subtitle: "", intro: "", curator: props.curator.slice(0, 60), template: "the-spread", accentIndex: null,
        items: props.selection.items.map(curationWork) };
      frame.current?.contentWindow?.postMessage({ type: "lecta:editor:init", document, id: props.id, version: props.version }, location.origin);
    }
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "lecta:editor:ready") { ready.current = true; initialize(); }
      if (event.data?.type === "lecta:editor:saved" && /^ex_[a-zA-Z0-9_-]+$/.test(event.data.id)) {
        window.history.replaceState(window.history.state, "", `/exhibitions/${event.data.id}/edit`);
      }
    };
    window.addEventListener("message", receive);
    initialize();
    return () => window.removeEventListener("message", receive);
  }, [selection.ready]);

  if (!canWrite) return <div className="wrap intro-stack" style={{ paddingBlock: "64px 120px" }}>
    <h1 className="display">Create a curation.</h1>
    <p className="lede">로그인하고 좋아하는 작품으로 나만의 큐레이션을 만들어 보세요.</p>
    <AuthButton user={null} /><Link href="/discover" className="btn-ghost">작품 둘러보기</Link>
  </div>;

  return <div className="curation-editor-shell">
    <iframe ref={frame} src="/curation/curation-editor-v5.html?service=1" title="큐레이션 편집기" className="curation-editor-frame" />
  </div>;
}
