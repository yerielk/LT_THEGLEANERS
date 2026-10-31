/**
 * Protocol smoke test against the running MCP server (npm run mcp:dev), using the official MCP client.
 * Exits non-zero on the first failed check. Secrets are never printed.
 * Uses LECTA_MCP_KEY if set; otherwise issues a temporary key for the demo user and revokes it at the end.
 */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { loadEnv } from "./env";
import { closeDb } from "../src/lib/db";
import { DEMO_ACTOR } from "../src/lib/services/actor";
import { createApiKey, revokeApiKey } from "../src/lib/services/api-keys";

loadEnv();
const URL_ = process.env.LECTA_MCP_URL || "http://127.0.0.1:3333/mcp";
let KEY = process.env.LECTA_MCP_KEY;
let issuedKeyId: string | null = null;
const SEED_EXHIBITION = "ex_on_things_left_unsaid";
const REQUIRED = ["search_works", "find_related_works", "get_exhibition", "recommend_for_exhibition", "create_exhibition_draft"];

let passed = 0;
function check(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    console.error(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : "");
    process.exit(1);
  }
  passed++;
  console.log(`  ✓ ${label}`);
}

async function connect(withKey: boolean) {
  const client = new Client({ name: "lecta-smoke", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(URL_), {
    requestInit: withKey && KEY ? { headers: { Authorization: `Bearer ${KEY}` } } : undefined,
  });
  await client.connect(transport);
  return client;
}

type Structured = Record<string, any>;
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const t0 = Date.now();
  const res = (await client.callTool({ name, arguments: args })) as { structuredContent?: Structured; isError?: boolean };
  const ms = Date.now() - t0;
  console.log(`  → ${name}(${JSON.stringify(args).slice(0, 120)}) ${res.isError ? "isError" : "ok"} in ${ms}ms`);
  return { data: (res.structuredContent ?? {}) as Structured, isError: !!res.isError };
}

async function main() {
  console.log(`[mcp:smoke] ${URL_}`);
  const anon = await connect(false);

  console.log("1) tools/list");
  const { tools } = await anon.listTools();
  const names = tools.map((t) => t.name);
  for (const n of REQUIRED) check(names.includes(n), `tool exposed: ${n}`);
  check(tools.every((t) => t.description && t.inputSchema), "every tool has a description and input schema");

  console.log("2) search_works");
  const s = await call(anon, "search_works", { query: "memory" });
  check(!s.isError && s.data.works?.length > 0, `search 'memory' returned ${s.data.works?.length} real works`, s.data);
  const empty = await call(anon, "search_works", { query: "zzqqxx-not-a-work" });
  check(!empty.isError && empty.data.total === 0, "nonsense query returns an empty result, not an error");

  console.log("3) get_exhibition (seeded, public)");
  const ex = await call(anon, "get_exhibition", { exhibitionId: SEED_EXHIBITION });
  check(!ex.isError && ex.data.items?.length >= 2, `seeded exhibition has ${ex.data.items?.length} works`, ex.data);
  const missing = await call(anon, "get_exhibition", { exhibitionId: "ex_does_not_exist" });
  check(missing.isError && missing.data.error?.code === "EXHIBITION_NOT_FOUND", "unknown id → EXHIBITION_NOT_FOUND", missing.data);

  console.log("4) recommend_for_exhibition");
  const seedIds: string[] = ex.data.items.map((i: { workId: string }) => i.workId);
  const rec = await call(anon, "recommend_for_exhibition", { exhibitionId: SEED_EXHIBITION, targetMedium: "BOOK", limit: 2, likedReasons: ["understated dialogue"] });
  check(!rec.isError && rec.data.recommendations?.length === 2, "2 book recommendations returned", rec.data);
  check(rec.data.recommendations.every((r: any) => r.medium === "BOOK"), "all recommendations respect targetMedium=BOOK");
  check(rec.data.recommendations.every((r: any) => !seedIds.includes(r.workId)), "no seed work is recommended");
  check(rec.data.recommendations.every((r: any) => r.reasons?.length >= 2), "each recommendation carries ≥2 reasons");
  const recIds: string[] = rec.data.recommendations.map((r: any) => r.workId);
  for (const id of recIds) {
    const found = await call(anon, "search_works", { query: rec.data.recommendations.find((r: any) => r.workId === id).title, limit: 20 });
    check(found.data.works.some((w: any) => w.id === id), `recommended ${id} exists in the catalog`);
  }

  console.log("4b) find_related_works (UAT-03: 2 seed ids, target_media=book, limit=3)");
  const fr = await call(anon, "find_related_works", { seed_work_ids: seedIds.slice(0, 2), target_media: "book", limit: 3 });
  check(!fr.isError && fr.data.results?.length === 3, "3 related works returned", fr.data);
  check(fr.data.results.every((r: any) => r.media_type === "book" && !seedIds.slice(0, 2).includes(r.work_id)), "all are books and none is a seed");
  check(fr.data.results.every((r: any) => r.work_id && r.title && r.reasons?.length >= 1), "each result has id, title and reasons");
  const frEmpty = await call(anon, "find_related_works", {});
  check(frEmpty.isError && frEmpty.data.error?.code === "VALIDATION_ERROR", "no seeds → VALIDATION_ERROR with guidance");
  const frBad = await call(anon, "find_related_works", { seed_work_ids: ["w_not_real_123"] });
  check(frBad.isError && frBad.data.error?.code === "WORK_NOT_FOUND", "unknown seed id → WORK_NOT_FOUND (no invented works)");

  console.log("5) create_exhibition_draft without a key → must fail");
  const draftArgs = {
    title: `Smoke draft ${new Date().toISOString().slice(0, 16)}`,
    description: "Created by npm run mcp:smoke",
    workIds: [seedIds[0], ...recIds],
    curatorNotes: [{ workId: recIds[0], note: "Recommended by Lecta for its restraint." }],
    requestId: `smoke-${Date.now()}`,
    approvedByHuman: true,
  };
  const denied = await call(anon, "create_exhibition_draft", draftArgs);
  check(denied.isError && denied.data.error?.code === "UNAUTHORIZED", "anonymous write → UNAUTHORIZED", denied.data);

  if (!KEY) {
    const issued = await createApiKey(DEMO_ACTOR, "mcp:smoke (temporary)");
    KEY = issued.key;
    issuedKeyId = issued.id;
    console.log("  (issued a temporary MCP key for the demo user)");
  }
  const authed = await connect(true);
  console.log("6) authorised write without human approval → must fail");
  const noApproval = await call(authed, "create_exhibition_draft", { ...draftArgs, approvedByHuman: false });
  check(noApproval.isError && noApproval.data.error?.code === "FORBIDDEN", "approvedByHuman=false → FORBIDDEN", noApproval.data);

  console.log("7) authorised + approved write, then read-back");
  const created = await call(authed, "create_exhibition_draft", draftArgs);
  check(!created.isError && created.data.status === "DRAFT" && created.data.exhibitionId, `draft created: ${created.data.exhibitionId}`, created.data);
  const replay = await call(authed, "create_exhibition_draft", draftArgs);
  check(!replay.isError && replay.data.exhibitionId === created.data.exhibitionId && replay.data.created === false, "same requestId does not create a duplicate");
  const back = await call(authed, "get_exhibition", { exhibitionId: created.data.exhibitionId });
  check(!back.isError && back.data.title === draftArgs.title, "read-back title matches");
  check(JSON.stringify(back.data.items.map((i: any) => i.workId)) === JSON.stringify(draftArgs.workIds), "read-back items and order match");
  check(back.data.visibility === "DRAFT", "read-back visibility is DRAFT");
  const peek = await call(anon, "get_exhibition", { exhibitionId: created.data.exhibitionId });
  check(peek.isError && peek.data.error?.code === "UNAUTHORIZED", "the private draft is not readable without the key");

  await anon.close();
  await authed.close();
  if (issuedKeyId) await revokeApiKey(DEMO_ACTOR, issuedKeyId);
  await closeDb();
  console.log(`\n[mcp:smoke] PASS — ${passed} checks`);
}

main().catch((e) => {
  console.error(`[mcp:smoke] FAIL — ${(e as Error).message}`);
  console.error("Is the MCP server running? `npm run mcp:dev`");
  process.exit(1);
});
