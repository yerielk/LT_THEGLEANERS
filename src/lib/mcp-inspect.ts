import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

export const mcpUrl = () => process.env.LECTA_MCP_URL || "http://127.0.0.1:3333/mcp";

export interface TraceStep {
  step: number;
  method: "tools/list" | "tools/call";
  tool?: string;
  input?: Record<string, unknown>;
  ok: boolean;
  ms: number;
  summary: string;
  resultIds?: string[];
}

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "lecta-agent-lab", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl())), { timeout: 5000 });
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export async function mcpStatus() {
  const base = mcpUrl().replace(/\/mcp$/, "");
  try {
    const ctl = AbortSignal.timeout(2000);
    const health = await (await fetch(`${base}/health`, { signal: ctl, cache: "no-store" })).json();
    const tools = await withClient(async (c) => (await c.listTools()).tools.map((t) => ({ name: t.name, title: t.title ?? t.name, description: t.description ?? "", readOnly: t.annotations?.readOnlyHint ?? false })));
    return { online: true as const, url: mcpUrl(), health, tools };
  } catch (e) {
    return { online: false as const, url: mcpUrl(), error: (e as Error).message };
  }
}

/** Real read-only protocol run: tools/list → search_works → get_exhibition → recommend_for_exhibition. */
export async function protocolTest(exhibitionId: string): Promise<TraceStep[]> {
  const trace: TraceStep[] = [];
  await withClient(async (c) => {
    let t0 = Date.now();
    const { tools } = await c.listTools();
    trace.push({ step: 1, method: "tools/list", ok: true, ms: Date.now() - t0, summary: `${tools.length} tools: ${tools.map((t) => t.name).join(", ")}` });

    const call = async (tool: string, input: Record<string, unknown>, summarize: (d: any) => { summary: string; ids?: string[] }) => {
      t0 = Date.now();
      const res = (await c.callTool({ name: tool, arguments: input })) as { structuredContent?: any; isError?: boolean };
      const d = res.structuredContent ?? {};
      const s = res.isError ? { summary: `${d.error?.code}: ${d.error?.message}` } : summarize(d);
      trace.push({ step: trace.length + 1, method: "tools/call", tool, input, ok: !res.isError, ms: Date.now() - t0, summary: s.summary, resultIds: s.ids });
      return res.isError ? null : d;
    };

    await call("search_works", { query: "memory", limit: 5 }, (d) => ({ summary: `${d.total} matches, first ${d.works.length} returned`, ids: d.works.map((w: any) => w.id) }));
    const ex = await call("get_exhibition", { exhibitionId }, (d) => ({ summary: `"${d.title}" · ${d.items.length} works · ${d.visibility}`, ids: d.items.map((i: any) => i.workId) }));
    if (ex) {
      await call("recommend_for_exhibition", { exhibitionId, limit: 3 }, (d) => ({
        summary: d.recommendations.map((r: any) => `${r.title} (${r.score})`).join(", "),
        ids: d.recommendations.map((r: any) => r.workId),
      }));
    }
  });
  return trace;
}
