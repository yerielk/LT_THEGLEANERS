"use client";
import { useState } from "react";
import type { TraceStep } from "@/lib/mcp-inspect";

export function ProtocolTest({ online, exhibitions }: { online: boolean; exhibitions: { id: string; title: string }[] }) {
  const [exId, setExId] = useState(exhibitions[0]?.id ?? "");
  const [trace, setTrace] = useState<TraceStep[] | null>(null);
  const [ranAt, setRanAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function runTest() {
    setBusy(true); setErr(""); setTrace(null);
    try {
      const res = await fetch("/api/agent-lab/protocol-test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ exhibitionId: exId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Protocol test failed");
      setTrace(body.trace); setRanAt(body.ranAt);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div>
      <h2 className="h3" style={{ marginTop: 0 }}>Protocol test</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        실제 MCP 클라이언트가 서버에 접속해 <code>tools/list → search_works → get_exhibition → recommend_for_exhibition</code>을 순서대로 호출해요.
        읽기 전용이며, 언어 모델은 쓰지 않아요 (자연어 에이전트 실행은 <code>npm run agent:demo</code>).
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "16px 0" }}>
        <label className="sr-only" htmlFor="ex">Exhibition</label>
        <select id="ex" className="select" style={{ maxWidth: 320 }} value={exId} onChange={(e) => setExId(e.target.value)}>
          {exhibitions.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <button className="btn" onClick={runTest} disabled={!online || busy}>{busy ? "Running…" : "Run protocol test"}</button>
      </div>
      {!online && <p className="notice error">MCP server is offline. Start it with <code>npm run mcp:dev</code> and reload.</p>}
      {err && <p className="notice error" role="alert">{err}</p>}
      {trace && (
        <>
          <p className="caption">Ran at {new Date(ranAt).toLocaleTimeString("ko-KR")}</p>
          <ol className="trace">
            {trace.map((t) => (
              <li key={t.step}>
                <span className="serif" style={{ fontSize: 20 }}>{t.step}</span>
                <span>
                  <b>{t.method}</b>{t.tool ? <> <code>{t.tool}</code></> : null} <span className={`badge ${t.ok ? "badge-olive" : "badge-rust"}`}>{t.ok ? "ok" : "error"}</span>
                  {t.input && <pre className="io">{JSON.stringify(t.input)}</pre>}
                  <span style={{ display: "block", marginTop: 4 }}>{t.summary}</span>
                  {t.resultIds?.length ? <span className="muted" style={{ fontSize: 12.5 }}>ids: {t.resultIds.join(", ")}</span> : null}
                </span>
                <span className="muted" style={{ fontSize: 13 }}>{t.ms}ms</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
