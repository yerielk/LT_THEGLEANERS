import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mcpStatus } from "@/lib/mcp-inspect";
import { listFeatured } from "@/lib/services/exhibitions";
import { canUseAgentLab, webActor } from "@/lib/services/web-actor";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentActivity } from "@/lib/schema";
import { ProtocolTest } from "./ProtocolTest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agent lab" };

export default async function AgentLab() {
  const actor = await webActor();
  if (!canUseAgentLab(actor)) notFound();
  const status = await mcpStatus();
  const exhibitions = (await listFeatured(actor)).map((e) => ({ id: e.id, title: e.title }));
  const activity = await getDb()
    .select({ tool_name: agentActivity.toolName, actor: agentActivity.actor, status: agentActivity.status, duration_ms: agentActivity.durationMs, target_id: agentActivity.targetId, created_at: agentActivity.createdAt })
    .from(agentActivity)
    .orderBy(desc(agentActivity.createdAt))
    .limit(12);
  return (
    <div className="wrap">
      <header className="page-head">
        <p className="caption">Dev / UAT inspector</p>
        <h1 className="display" style={{ margin: "8px 0 0", fontSize: "clamp(48px, 6vw, 88px)" }}>Agent lab.</h1>
      </header>
      <div className="lab-grid">
        <section>
          <h2 className="h3" style={{ marginTop: 0 }}>
            <span className={`status-dot${status.online ? " on" : ""}`} aria-hidden />MCP server {status.online ? "online" : "offline"}
          </h2>
          <p style={{ fontSize: 14 }}><code>{status.url}</code></p>
          {status.online ? (
            <>
              <p className="muted" style={{ fontSize: 14 }}>
                DB {status.health.db ? "ok" : "unavailable"} / writes need a personal MCP key + human approval
              </p>
              <ul className="tool-list">
                {status.tools.map((t) => (
                  <li key={t.name}>
                    <code>{t.name}</code> <span className={`badge ${t.readOnly ? "badge-olive" : "badge-rust"}`}>{t.readOnly ? "read" : "write"}</span>
                    <p className="muted" style={{ fontSize: 13.5, margin: "6px 0 0" }}>{t.description}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="notice error">연결할 수 없어요: {status.error}. <code>npm run mcp:dev</code>로 서버를 켜 주세요.</p>
          )}
          <h2 className="h3" style={{ marginTop: 40 }}>Recent tool calls</h2>
          {activity.length === 0 ? <p className="muted" style={{ fontSize: 14 }}>아직 기록된 MCP 호출이 없어요.</p> : (
            <ol className="trace">
              {activity.map((a, i) => (
                <li key={i} style={{ gridTemplateColumns: "1fr auto" }}>
                  <span><code>{a.tool_name}</code> <span className={`badge ${a.status === "ok" ? "badge-olive" : "badge-rust"}`}>{a.status}</span><br /><span className="muted" style={{ fontSize: 12.5 }}>{a.actor}{a.target_id ? ` / ${a.target_id}` : ""}</span></span>
                  <span className="muted" style={{ fontSize: 12.5, textAlign: "right" }}>{new Date(a.created_at).toLocaleTimeString("ko-KR")}<br />{a.duration_ms}ms</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section><ProtocolTest online={status.online} exhibitions={exhibitions} /></section>
      </div>
    </div>
  );
}
