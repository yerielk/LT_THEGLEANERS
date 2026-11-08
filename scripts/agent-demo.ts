/**
 * Real LLM agent → MCP tool-calling loop (optional, needs ANTHROPIC_API_KEY or OPENAI_API_KEY).
 * The model API is chosen by LLM_PROVIDER (anthropic | openai), or by whichever key is set; see scripts/llm.ts.
 *
 * The model sees ONLY the tools returned by MCP tools/list (name, description, JSON schema) and decides which to call.
 * Every model function call is forwarded to the MCP server with callTool. WRITE calls stop and ask the human
 * (y/N) unless --approve-write was passed explicitly. Max 8 tool calls. The final state is verified with get_exhibition.
 *
 *   npm run agent:demo -- "Lecta에서 'On Things Left Unsaid' 전시를 조회하고 비슷한 정서의 책 2권을 찾아 ..."
 */
import readline from "node:readline/promises";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { loadEnv } from "./env";
import { API_KEY_ENV, createChat, pickProvider, type ToolResult } from "./llm";

loadEnv();
const MCP_URL = process.env.LECTA_MCP_URL || "http://127.0.0.1:3333/mcp";
const MAX_CALLS = 8;
const WRITE_TOOLS = new Set(["create_exhibition_draft"]);
const args = process.argv.slice(2);
const autoApprove = args.includes("--approve-write");
const prompt =
  args.filter((a) => !a.startsWith("--")).join(" ") ||
  "Lecta에서 'On Things Left Unsaid' 전시(ex_on_things_left_unsaid)를 조회하고 비슷한 정서의 책 2권을 찾아, 사용자가 승인하면 원래 전시의 영화 1편과 그 책들로 비공개 전시 초안을 만든 다음 다시 조회해서 결과를 한국어로 보고해줘.";

const redact = (v: unknown) => JSON.stringify(v, (k, val) => (/key|token|authorization/i.test(k) ? "[redacted]" : val));

async function main() {
  const provider = pickProvider(process.env);
  if (!provider || !process.env[API_KEY_ENV[provider]]) {
    console.log(`[agent:demo] model credentials missing — set ${provider ? API_KEY_ENV[provider] : "ANTHROPIC_API_KEY or OPENAI_API_KEY"} in .env to run the LLM agent.`);
    console.log("[agent:demo] This is NOT an agent run. The MCP protocol itself is verified without a model by `npm run mcp:smoke`.");
    process.exit(2);
  }
  if (!process.env.LECTA_MCP_KEY) console.log("[agent:demo] note: LECTA_MCP_KEY missing — issue a personal key under My rooms; the write step will be refused without it.");

  const client = new Client({ name: "lecta-agent-demo", version: "0.1.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(MCP_URL), {
      requestInit: process.env.LECTA_MCP_KEY ? { headers: { Authorization: `Bearer ${process.env.LECTA_MCP_KEY}` } } : undefined,
    }),
  );
  const { tools } = await client.listTools();
  console.log(`[agent:demo] MCP ${MCP_URL} — discovered tools: ${tools.map((t) => t.name).join(", ")}`);
  const system =
    "You are an agent using the Lecta MCP tools. Only use IDs returned by tools; never invent works. " +
    "Do not ask for write approval in chat: when the draft is ready, call create_exhibition_draft directly. " +
    "The runtime then shows the exact draft to the human, asks y/N and sets approvedByHuman itself; if the write is refused, stop. " +
    "After creating a draft, call get_exhibition to verify it, then report the persisted title, items and draft id.";

  // MCP tools/list → the model's tool definitions (the JSON schema is passed through as-is)
  const chat = createChat(provider, { system, prompt, tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> })) });
  console.log(`[agent:demo] model ${provider}/${chat.model}\n[user] ${prompt}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let calls = 0;
  let lastCreatedId: string | null = null;

  for (let turn = 0; turn < 12; turn++) {
    const res = await chat.next();
    if (res.refused) {
      console.log(`\n[agent:demo] the model declined (${res.refused}).`);
      break;
    }
    if (!res.calls.length) {
      console.log(`\n[agent] ${res.text}`);
      // the model may still end its turn with a question: let the human answer, or press Enter to finish
      const reply = autoApprove ? "" : (await rl.question("\n[you] (Enter to finish) ")).trim();
      if (!reply) break;
      chat.addUserText(reply);
      continue;
    }
    const results: ToolResult[] = [];
    for (const tc of res.calls) {
      if (++calls > MAX_CALLS) {
        console.log(`[agent:demo] stopped: more than ${MAX_CALLS} tool calls`);
        await client.close(); rl.close(); process.exit(1);
      }
      const name = tc.name;
      const input = { ...tc.input };

      if (WRITE_TOOLS.has(name)) {
        console.log(`\n[approval] The agent wants to WRITE via ${name}:\n${JSON.stringify({ ...input, approvedByHuman: undefined }, null, 2)}`);
        const ok = autoApprove ? (console.log("[approval] --approve-write passed → approved"), true) : /^y(es)?$/i.test((await rl.question("Approve this write? (y/N) ")).trim());
        input.approvedByHuman = ok; // the human decides, not the model
        if (!ok) {
          console.log("[approval] declined — the write is not executed.");
          results.push({ id: tc.id, isError: true, content: JSON.stringify({ error: { code: "FORBIDDEN", message: "The human declined this write." } }) });
          continue;
        }
      }

      const t0 = Date.now();
      const out = (await client.callTool({ name, arguments: input })) as { structuredContent?: any; isError?: boolean; content?: any[] };
      const data = out.structuredContent ?? out.content;
      console.log(`[tool] ${name} ${redact(input).slice(0, 200)} → ${out.isError ? "ERROR " + redact(data?.error) : "ok"} (${Date.now() - t0}ms)`);
      if (name === "create_exhibition_draft" && !out.isError) lastCreatedId = data.exhibitionId;
      results.push({ id: tc.id, isError: !!out.isError, content: JSON.stringify(data).slice(0, 12000) });
    }
    chat.addToolResults(results);
  }

  if (lastCreatedId) {
    const back = (await client.callTool({ name: "get_exhibition", arguments: { exhibitionId: lastCreatedId } })) as { structuredContent?: any; isError?: boolean };
    console.log(`\n[verify] get_exhibition(${lastCreatedId}) → ${back.isError ? "ERROR" : `"${back.structuredContent.title}" · ${back.structuredContent.items.length} works · ${back.structuredContent.visibility}`}`);
  } else {
    console.log("\n[verify] no draft was created in this run.");
  }
  rl.close();
  await client.close();
}

main().catch((e) => {
  console.error(`[agent:demo] failed: ${(e as Error).message}`);
  process.exit(1);
});
