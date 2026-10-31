"use client";
import { useEffect, useState } from "react";

interface Key { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }

/** Personal MCP keys: issue (shown once), list, revoke. */
export function ApiKeys() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(input: string, init?: RequestInit) {
    const res = await fetch(input, { ...init, headers: { "content-type": "application/json" } });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    return body;
  }
  const load = () => call("/api/me/api-keys").then((b) => setKeys(b.keys)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setFresh(null);
    try {
      const b = await call("/api/me/api-keys", { method: "POST", body: JSON.stringify({ name }) });
      setFresh(b.key.key);
      setName("");
      await load();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true); setError(null);
    try { await call(`/api/me/api-keys/${id}`, { method: "DELETE" }); await load(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <section style={{ marginTop: 72 }} aria-labelledby="keys-title">
      <h2 id="keys-title" className="h3">MCP keys</h2>
      <p className="muted" style={{ fontSize: 14, maxWidth: "40em" }}>
        AI 에이전트가 내 이름으로 비공개 초안을 저장하려면 개인 키가 필요해요. 에이전트의 MCP 연결에 <code>Authorization: Bearer &lt;key&gt;</code>로 넣어 주세요. 쓰기마다 사람의 승인도 따로 필요해요.
      </p>
      <form onSubmit={issue} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "16px 0" }}>
        <input className="input" style={{ maxWidth: 280 }} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: Claude Desktop" aria-label="Key name" />
        <button type="submit" className="btn btn-sm" disabled={busy || !name.trim()}>Issue key</button>
      </form>
      {fresh && (
        <p className="notice" role="status">
          새 키예요. 지금만 보여요. 안전한 곳에 복사해 두세요.<br /><code style={{ wordBreak: "break-all" }}>{fresh}</code>
        </p>
      )}
      {error && <p className="notice error" role="alert">{error}</p>}
      {keys && keys.length === 0 && <p className="muted" style={{ fontSize: 14 }}>발급한 키가 없어요.</p>}
      {keys && keys.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 10 }}>
          {keys.map((k) => (
            <li key={k.id} style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <span><strong>{k.name}</strong> <code>{k.prefix}…</code></span>
              <span className="caption">
                발급 {new Date(k.createdAt).toLocaleDateString("ko-KR")} / {k.lastUsedAt ? `마지막 사용 ${new Date(k.lastUsedAt).toLocaleString("ko-KR")}` : "아직 사용 안 함"}
              </span>
              <button type="button" className="text-btn" disabled={busy} onClick={() => revoke(k.id)}>Revoke</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
