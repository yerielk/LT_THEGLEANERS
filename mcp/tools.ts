import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { searchWorks } from "../src/lib/services/works";
import { createExhibition, getExhibition } from "../src/lib/services/exhibitions";
import { recommend } from "../src/lib/recommendation/engine";
import { LectaError, asLectaError } from "../src/lib/services/errors";
import type { Actor } from "../src/lib/services/actor";
import { getDb, newId, nowIso } from "../src/lib/db";
import { MEDIA } from "../src/lib/validators";

export const TOOL_NAMES = ["search_works", "find_related_works", "get_exhibition", "recommend_for_exhibition", "create_exhibition_draft"] as const;

const appUrl = () => (process.env.LECTA_APP_URL || "http://localhost:3000").replace(/\/$/, "");

function logActivity(actor: Actor, tool: string, status: string, ms: number, extra: { requestId?: string; targetType?: string; targetId?: string; summary?: unknown } = {}) {
  try {
    getDb()
      .prepare("INSERT INTO agent_activity (id, actor, tool_name, request_id, target_type, target_id, status, duration_ms, safe_summary_json, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(newId("act"), actor.label, tool, extra.requestId ?? null, extra.targetType ?? null, extra.targetId ?? null, status, ms, extra.summary ? JSON.stringify(extra.summary) : null, nowIso());
  } catch {
    /* activity logging must never break a tool call */
  }
}

type ToolResult = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };

async function run(actor: Actor, tool: string, fn: () => { data: Record<string, unknown>; summary?: unknown; target?: [string, string]; requestId?: string }): Promise<ToolResult> {
  const t0 = Date.now();
  try {
    const out = fn();
    logActivity(actor, tool, "ok", Date.now() - t0, { summary: out.summary, targetType: out.target?.[0], targetId: out.target?.[1], requestId: out.requestId });
    return { content: [{ type: "text", text: JSON.stringify(out.data) }], structuredContent: out.data };
  } catch (e) {
    const err = asLectaError(e);
    logActivity(actor, tool, `error:${err.code}`, Date.now() - t0);
    const body = err.toJSON();
    return { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body, isError: true };
  }
}

const loose = <T extends z.ZodRawShape>(shape: T) => z.looseObject(shape);

/** Builds one McpServer bound to the caller's actor. Called per request by createMcpHandler. */
export function buildServer(actor: Actor): McpServer {
  const server = new McpServer(
    { name: "lecta", version: "0.1.0" },
    {
      instructions:
        "Lecta is a cultural taste archive. Use search_works to find real catalog IDs, get_exhibition to read an exhibition, " +
        "recommend_for_exhibition for explainable cross-medium recommendations, and create_exhibition_draft (requires a bearer key AND explicit human approval) to save a private draft. " +
        "After writing, call get_exhibition to verify the persisted state.",
    },
  );

  server.registerTool(
    "search_works",
    {
      title: "Search works",
      description:
        "Search Lecta's verified/curated cultural catalog across film, series, books and albums. Returns real IDs to pass into other tools. Matches title, creator and taste tags (English key or Korean label).",
      inputSchema: z.object({
        query: z.string().max(80).optional().describe("Free text, e.g. 'memory', 'Ishiguro', '그리움'"),
        medium: z.enum(MEDIA).optional(),
        limit: z.number().int().min(1).max(20).optional().describe("Default 10"),
      }),
      outputSchema: loose({ works: z.array(loose({ id: z.string() })), total: z.number(), appliedFilters: loose({}) }).or(loose({ error: loose({}) })),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, medium, limit }) =>
      run(actor, "search_works", () => {
        const res = searchWorks({ q: query, medium, limit: limit ?? 10 });
        const works = res.works.map((w) => ({
          id: w.id, title: w.title, creator: w.creator, medium: w.medium, releaseYear: w.releaseYear, tagKeys: w.tagKeys,
          source: w.source.name, metadataStatus: w.metadataStatus,
        }));
        return { data: { works, total: res.total, appliedFilters: { query: query ?? null, medium: medium ?? null, limit: limit ?? 10 } }, summary: { query, medium, returned: works.length } };
      }),
  );

  server.registerTool(
    "find_related_works",
    {
      title: "Find related works",
      description:
        "Recommend real catalog works related to a set of seed works and/or an exhibition (collection), optionally in another medium. " +
        "Pass seed_work_ids from search_works, or collection_id from get_exhibition. Never invents works: every result is an existing Lecta work ID with grounded reasons. Same engine as the web app (coldstart-v1).",
      inputSchema: z.object({
        seed_work_ids: z.array(z.string().min(3).max(64)).max(16).optional().describe("Work IDs returned by search_works"),
        collection_id: z.string().min(3).max(64).optional().describe("Exhibition ID (public, or your own draft with the bearer key)"),
        target_media: z.enum(["film", "series", "book", "album", "FILM", "SERIES", "BOOK", "ALBUM"]).optional(),
        limit: z.number().int().min(1).max(10).optional().describe("Default 3"),
        liked_reasons: z.array(z.string().max(80)).max(10).optional().describe("Why the user loves the seeds, e.g. ['lingering emotion']"),
      }),
      outputSchema: loose({ algorithm_version: z.string(), results: z.array(loose({ work_id: z.string() })) }).or(loose({ error: loose({}) })),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ seed_work_ids, collection_id, target_media, limit, liked_reasons }) =>
      run(actor, "find_related_works", () => {
        if (!seed_work_ids?.length && !collection_id) {
          throw new LectaError("VALIDATION_ERROR", "Provide seed_work_ids (from search_works) and/or collection_id (from get_exhibition).");
        }
        const r = recommend(
          {
            exhibitionId: collection_id,
            seedWorkIds: seed_work_ids,
            targetMedium: target_media ? (target_media.toUpperCase() as "FILM" | "SERIES" | "BOOK" | "ALBUM") : undefined,
            limit: limit ?? 3,
            likedReasons: liked_reasons,
          },
          actor,
        );
        const data = {
          algorithm_version: r.algorithmVersion,
          fallback_used: r.fallbackUsed,
          seeds: r.seeds.map((s) => ({ work_id: s.workId, title: s.title, media_type: s.medium.toLowerCase() })),
          excluded_work_ids: r.excludedSeedIds,
          results: r.recommendations.map((x) => ({
            work_id: x.workId, title: x.title, media_type: x.medium.toLowerCase(), creator: x.creator, year: x.releaseYear,
            score: x.score, score_breakdown: x.scoreBreakdown, confidence: x.confidenceLabel, source: x.source,
            reasons: x.reasons.map((rr) => ({ type: rr.type, tag: rr.tag ?? null, evidence_work_id: rr.evidenceWorkId ?? null, evidence_text: rr.evidenceText ?? null, text: rr.text })),
          })),
        };
        return { data, target: collection_id ? ["exhibition", collection_id] : undefined, summary: { returned: data.results.length, ids: data.results.map((x) => x.work_id) } };
      }),
  );

  server.registerTool(
    "get_exhibition",
    {
      title: "Get exhibition",
      description:
        "Read one exhibition with its ordered works and curator notes. Public/editorial exhibitions are readable by anyone; private drafts only by their owner (bearer key). Returns UNAUTHORIZED/FORBIDDEN or EXHIBITION_NOT_FOUND explicitly.",
      inputSchema: z.object({ exhibitionId: z.string().min(3).max(64) }),
      outputSchema: loose({ id: z.string(), title: z.string(), items: z.array(loose({ workId: z.string() })) }).or(loose({ error: loose({}) })),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ exhibitionId }) =>
      run(actor, "get_exhibition", () => {
        const ex = getExhibition(exhibitionId, actor);
        const data = {
          id: ex.id, number: ex.number, title: ex.title, description: ex.description, visibility: ex.visibility, isEditorialSample: ex.isEditorial,
          version: ex.version, updatedAt: ex.updatedAt, exhibitionUrl: `${appUrl()}/exhibitions/${ex.id}`,
          items: ex.items.map((i) => ({ workId: i.workId, workTitle: i.work.title, creator: i.work.creator, medium: i.work.medium, position: i.position, curatorNote: i.curatorNote })),
        };
        return { data, target: ["exhibition", ex.id], summary: { items: data.items.length, visibility: ex.visibility } };
      }),
  );

  server.registerTool(
    "recommend_for_exhibition",
    {
      title: "Recommend for exhibition",
      description:
        "Lecta's taste engine (coldstart-v1): recommends real catalog works that belong in the given exhibition, excluding works already in it, with a score breakdown and reasons grounded in the exhibition's works, its text and the stated 'why I liked it' reasons. Same engine as the web app.",
      inputSchema: z.object({
        exhibitionId: z.string().min(3).max(64),
        targetMedium: z.enum(MEDIA).optional(),
        limit: z.number().int().min(1).max(10).optional().describe("Default 3"),
        likedReasons: z.array(z.string().max(80)).max(10).optional().describe("e.g. ['understated dialogue', 'lingering_emotion']"),
      }),
      outputSchema: loose({ algorithmVersion: z.string(), recommendations: z.array(loose({ workId: z.string() })) }).or(loose({ error: loose({}) })),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ exhibitionId, targetMedium, limit, likedReasons }) =>
      run(actor, "recommend_for_exhibition", () => {
        const r = recommend({ exhibitionId, targetMedium, limit: limit ?? 3, likedReasons }, actor);
        const data = {
          algorithmVersion: r.algorithmVersion,
          fallbackUsed: r.fallbackUsed,
          excludedSeedIds: r.excludedSeedIds,
          appliedReasons: r.appliedReasons,
          recommendations: r.recommendations.map((x) => ({
            workId: x.workId, title: x.title, creator: x.creator, medium: x.medium, score: x.score, scoreBreakdown: x.scoreBreakdown,
            confidenceLabel: x.confidenceLabel, source: x.source,
            reasons: x.reasons.map((rr) => ({ type: rr.type, tag: rr.tag, evidenceWorkId: rr.evidenceWorkId, evidenceText: rr.evidenceText, text: rr.text })),
          })),
        };
        return { data, target: ["exhibition", exhibitionId], summary: { returned: data.recommendations.length, ids: data.recommendations.map((x) => x.workId) } };
      }),
  );

  server.registerTool(
    "create_exhibition_draft",
    {
      title: "Create exhibition draft (WRITE — needs human approval)",
      description:
        "WRITE. Creates a PRIVATE draft exhibition for the authenticated demo user from 2–8 existing work IDs. Requires `Authorization: Bearer <LECTA_MCP_WRITE_KEY>` on the connection AND approvedByHuman=true, which an agent may only set after the human explicitly confirmed this exact draft. Pass a requestId so retries do not create duplicates. Verify afterwards with get_exhibition.",
      inputSchema: z.object({
        title: z.string().min(1).max(80),
        description: z.string().max(400).optional(),
        workIds: z.array(z.string().min(3).max(64)).min(2).max(8),
        curatorNotes: z.array(z.object({ workId: z.string(), note: z.string().max(200) })).max(8).optional(),
        requestId: z.string().min(6).max(64).optional(),
        approvedByHuman: z.boolean().describe("Must be true, and only after the human confirmed this write."),
      }),
      outputSchema: loose({ exhibitionId: z.string(), status: z.string(), itemCount: z.number() }).or(loose({ error: loose({}) })),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ approvedByHuman, ...input }) =>
      run(actor, "create_exhibition_draft", () => {
        if (actor.kind !== "agent") throw new LectaError("UNAUTHORIZED", "create_exhibition_draft requires a valid bearer key (LECTA_MCP_WRITE_KEY) with DEMO_MODE=true.");
        if (approvedByHuman !== true) throw new LectaError("FORBIDDEN", "Human approval is required before writing. Ask the user to confirm, then call again with approvedByHuman=true.");
        const { exhibition, created } = createExhibition(input, actor, { origin: "MODEL_SUGGESTED" });
        const data = {
          exhibitionId: exhibition.id, status: exhibition.visibility, itemCount: exhibition.items.length, created,
          exhibitionUrl: `${appUrl()}/exhibitions/${exhibition.id}`,
          verificationHint: `Call get_exhibition with exhibitionId="${exhibition.id}" to confirm the persisted title and items.`,
        };
        return { data, target: ["exhibition", exhibition.id], requestId: input.requestId, summary: { created, itemCount: data.itemCount } };
      }),
  );

  return server;
}
