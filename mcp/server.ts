/**
 * Lecta MCP server — standalone Node process, Streamable HTTP at http://127.0.0.1:3333/mcp.
 * Uses the same SQLite database and service layer as the Next.js app (src/lib/*).
 */
import http from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { buildServer, TOOL_NAMES } from "./tools";
import { agentActorFromAuthHeader, demoModeEnabled } from "../src/lib/services/actor";
import { getDb } from "../src/lib/db";
import { loadEnv } from "../scripts/env";

loadEnv();
const PORT = Number(process.env.MCP_PORT || 3333);
const HOST = process.env.MCP_HOST || "127.0.0.1";

const handler = createMcpHandler(
  (ctx) => buildServer(agentActorFromAuthHeader(ctx.requestInfo?.headers.get("authorization"))),
  { onerror: (e) => console.error("[mcp] error:", e.message) },
);

function toRequest(req: http.IncomingMessage, body: Buffer): Request {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  const url = `http://${req.headers.host ?? `${HOST}:${PORT}`}${req.url ?? "/"}`;
  const hasBody = req.method !== "GET" && req.method !== "HEAD" && body.length > 0;
  return new Request(url, { method: req.method, headers, body: hasBody ? new Uint8Array(body) : undefined });
}

async function send(res: http.ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (!response.body) return res.end();
  const reader = response.body.getReader();
  res.on("close", () => reader.cancel().catch(() => {}));
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

const MAX_BODY = 1024 * 1024;

const server = http.createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  // CORS for local tools (MCP Inspector, the Next.js agent lab runs server-side so it does not need this)
  res.setHeader("Access-Control-Allow-Origin", process.env.MCP_ALLOWED_ORIGIN || "http://localhost:6274");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, mcp-session-id, mcp-protocol-version, accept");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  if (path === "/health") {
    let dbOk = false;
    try { getDb().prepare("SELECT 1").get(); dbOk = true; } catch { /* reported below */ }
    res.setHeader("content-type", "application/json");
    res.statusCode = dbOk ? 200 : 503;
    return res.end(JSON.stringify({ status: dbOk ? "ok" : "degraded", db: dbOk, tools: TOOL_NAMES, demoMode: demoModeEnabled(), writeKeyConfigured: !!process.env.LECTA_MCP_WRITE_KEY, endpoint: "/mcp" }));
  }
  if (path !== "/mcp") { res.statusCode = 404; return res.end("Not found"); }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) { res.statusCode = 413; return res.end("Payload too large"); }
    chunks.push(c as Buffer);
  }
  try {
    await send(res, await handler.fetch(toRequest(req, Buffer.concat(chunks))));
  } catch (e) {
    console.error("[mcp] request failed:", (e as Error).message);
    if (!res.headersSent) { res.statusCode = 500; res.end("Internal error"); }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[mcp] Lecta MCP server on http://${HOST}:${PORT}/mcp  (health: /health)`);
  console.log(`[mcp] tools: ${TOOL_NAMES.join(", ")}`);
  console.log(`[mcp] DEMO_MODE=${demoModeEnabled()}  write key ${process.env.LECTA_MCP_WRITE_KEY ? "configured" : "NOT configured (writes disabled)"}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { server.close(); handler.close().finally(() => process.exit(0)); });
