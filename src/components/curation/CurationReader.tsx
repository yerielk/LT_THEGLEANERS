"use client";
import { useEffect, useRef, useState } from "react";
import type { CurationDocument } from "@/lib/curation/document";

export function CurationReader({ document }: { document: CurationDocument }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== "lecta:ready") return;
      frame.current.contentWindow?.postMessage({ type: "lecta:curation", data: document }, location.origin);
    };
    window.addEventListener("message", receive);
    // A recommendation can refresh this server page while the same template iframe stays mounted.
    frame.current?.contentWindow?.postMessage({ type: "lecta:curation", data: document }, location.origin);
    return () => window.removeEventListener("message", receive);
  }, [document]);
  return <>
    {error && <p role="alert" className="notice error">템플릿을 불러오지 못했어요. 페이지를 새로고침해 주세요.</p>}
    <iframe ref={frame} src={`/curation/${document.template}.html?embed=1`} title={`${document.title} / ${document.template}`} className="curation-reader-frame" onError={() => setError(true)} />
  </>;
}
