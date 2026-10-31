import type { DatabaseSync } from "node:sqlite";
import { getDb, newId, nowIso } from "../db";
import { allWorks, type WorkView } from "../services/works";
import { getExhibition } from "../services/exhibitions";
import type { Actor } from "../services/actor";
import { LectaError } from "../services/errors";
import { recommendationRequestSchema, zodMessage, type RecommendationRequest } from "../validators";
import { extractTagsFromText, resolveReasons, normalize, tagLabel, TAG_BY_KEY } from "./tags";
import type { Medium } from "../data/catalog";

/**
 * coldstart-v1 — Collection → Work recommendation that works with zero behavioural data.
 *
 *   score = 0.35*S + 0.25*W + 0.20*C + 0.10*D + 0.10*N      (weights renormalised over available features)
 *
 *   S  semantic/context similarity: mean of (a) cosine between candidate tag vector and the seed works'
 *      averaged tag vector and (b) TF-IDF cosine between candidate text and seed + exhibition text.
 *   W  why similarity: weighted overlap between the user's stated reasons (resolved to tag keys) and candidate tags.
 *      Missing when no reasons are given.
 *   C  collection theme fit: overlap between tags found in the exhibition title/description/curator notes and the
 *      candidate's tags. Missing when that text yields no tags.
 *   D  diversity: 1 − max tag-cosine to works already picked in this result (greedy MMR); same-creator penalty.
 *   N  novelty: cross-medium bonus (candidate medium not among the seeds) and a penalty for repeating a seed creator.
 *
 * Deterministic: no randomness, ties broken by workId.
 */
export const ALGORITHM_VERSION = "coldstart-v1";
const MEDIUM_KO: Record<Medium, string> = { FILM: "영화", SERIES: "시리즈", BOOK: "책", ALBUM: "앨범" };
const WEIGHTS = { S: 0.35, W: 0.25, C: 0.2, D: 0.1, N: 0.1 } as const;

export interface Reason {
  type: "shared_theme" | "why_match" | "curation_context" | "cross_medium";
  tag?: string;
  tagLabel?: string;
  evidenceWorkId?: string;
  evidenceWorkTitle?: string;
  evidenceText?: string;
  text: string;
}

export interface Recommendation {
  workId: string;
  title: string;
  creator: string;
  medium: Medium;
  releaseYear: number | null;
  coverTone: string | null;
  artwork: WorkView["artwork"];
  score: number;
  scoreBreakdown: { semantic: number; why: number | null; theme: number | null; diversity: number; discovery: number };
  matchedTags: string[];
  reasons: Reason[];
  provenance: "curated_metadata";
  source: string;
  confidenceLabel: "editorially_matched" | "exploratory";
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  algorithmVersion: string;
  fallbackUsed: boolean;
  excludedSeedIds: string[];
  seeds: { workId: string; title: string; medium: Medium }[];
  appliedReasons: { key: string; label: string; from: string }[];
  collectionTags: { key: string; label: string; from: string }[];
}

type Vec = Map<string, number>;

const round = (x: number) => Math.round(x * 1000) / 1000;

function tagVec(w: WorkView): Vec {
  return new Map(w.tags.map((t) => [t.key, t.weight]));
}

function cosine(a: Vec, b: Vec): number {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) {
    na += v * v;
    const bv = b.get(k);
    if (bv) dot += v * bv;
  }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const STOP = new Set("a an the of and or to in on for with by from at is are was were be it its this that as about after into their they we our your you his her he she them who what".split(" "));

function tokens(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t.length > 1 && !STOP.has(t));
}

function workText(w: WorkView): string {
  const tagWords = w.tags.map((t) => `${t.key.replace(/_/g, " ")} ${TAG_BY_KEY[t.key]?.en ?? ""}`).join(" ");
  return `${w.title} ${w.creator} ${w.synopsis ?? ""} ${tagWords}`;
}

function tfidf(docTokens: string[], idf: Map<string, number>): Vec {
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const v: Vec = new Map();
  for (const [t, c] of tf) v.set(t, c * (idf.get(t) ?? 0));
  return v;
}

export function recommend(input: RecommendationRequest, actor: Actor, db: DatabaseSync = getDb(), opts: { log?: boolean } = {}): RecommendationResult {
  const parsed = recommendationRequestSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const req = parsed.data;

  const catalog = allWorks(db);
  const byId = new Map(catalog.map((w) => [w.id, w]));

  // ── 1. seeds and collection context ──────────────────────────────────────
  let seedIds = req.seedWorkIds ?? [];
  let title = req.collectionTitle ?? "";
  let description = req.description ?? "";
  const notes: { workId: string; note: string }[] = [];
  if (req.exhibitionId) {
    const ex = getExhibition(req.exhibitionId, actor, db); // enforces read permission
    seedIds = [...new Set([...ex.items.map((i) => i.workId), ...seedIds])];
    title = title || ex.title;
    description = description || ex.description || "";
    for (const i of ex.items) if (i.curatorNote) notes.push({ workId: i.workId, note: i.curatorNote });
  }
  if (!seedIds.length) throw new LectaError("VALIDATION_ERROR", "Provide an exhibitionId or at least one seedWorkId.");
  const missing = seedIds.filter((id) => !byId.has(id));
  if (missing.length) throw new LectaError("WORK_NOT_FOUND", `Unknown seed work id(s): ${missing.join(", ")}`, false, { missing });
  const seeds = seedIds.map((id) => byId.get(id)!);

  // seed profile: average tag vector, and which seed carries each tag most strongly (for evidence)
  const seedVec: Vec = new Map();
  const tagEvidence = new Map<string, { work: WorkView; weight: number }>();
  for (const s of seeds) {
    for (const t of s.tags) {
      seedVec.set(t.key, (seedVec.get(t.key) ?? 0) + t.weight / seeds.length);
      const cur = tagEvidence.get(t.key);
      if (!cur || t.weight > cur.weight || (t.weight === cur.weight && s.id < cur.work.id)) tagEvidence.set(t.key, { work: s, weight: t.weight });
    }
  }

  const whyTags = resolveReasons(req.likedReasons);
  const collectionText = [title, description, ...notes.map((n) => n.note)].join(". ");
  const collectionTags = extractTagsFromText(collectionText);

  // ── 2. candidate pool ────────────────────────────────────────────────────
  const excluded = new Set([...seedIds, ...(req.excludedWorkIds ?? [])]);
  const seedMedia = new Set(seeds.map((s) => s.medium));
  const seedCreators = new Set(seeds.map((s) => normalize(s.creator)));
  const seedTitles = new Set(seeds.map((s) => normalize(s.title)));
  // exclude seeds, explicit exclusions, incomplete metadata and adaptations of a seed (same title in another medium)
  let pool = catalog.filter((w) => !excluded.has(w.id) && w.metadataStatus !== "INCOMPLETE" && !seedTitles.has(normalize(w.title)));
  if (req.targetMedium) pool = pool.filter((w) => w.medium === req.targetMedium);
  if (!pool.length) throw new LectaError("RECOMMENDATION_EMPTY", "No catalog works left to recommend for these filters.");

  // TF-IDF over the whole catalog
  const docs = new Map(catalog.map((w) => [w.id, tokens(workText(w))]));
  const df = new Map<string, number>();
  for (const toks of docs.values()) for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map([...df].map(([t, n]) => [t, Math.log((1 + catalog.length) / (1 + n)) + 1]));
  const queryVec = tfidf([...seeds.flatMap((s) => docs.get(s.id)!), ...tokens(collectionText)], idf);

  // ── 3. base features ─────────────────────────────────────────────────────
  interface Cand { w: WorkView; vec: Vec; S: number; W: number | null; C: number | null; N: number }
  const cands: Cand[] = pool.map((w) => {
    const vec = tagVec(w);
    const S = 0.5 * cosine(vec, seedVec) + 0.5 * cosine(tfidf(docs.get(w.id)!, idf), queryVec);
    const W = whyTags.length ? whyTags.reduce((acc, t) => acc + (vec.get(t.key) ?? 0), 0) / whyTags.length : null;
    const C = collectionTags.length ? collectionTags.reduce((acc, t) => acc + (vec.get(t.key) ?? 0), 0) / collectionTags.length : null;
    let N = seedMedia.has(w.medium) ? 0.4 : 1;
    if (seedCreators.has(normalize(w.creator))) N -= 0.3;
    return { w, vec, S, W, C, N: Math.max(0, N) };
  });

  // ── 4. greedy MMR selection with renormalised weights ────────────────────
  const picked: { c: Cand; D: number; score: number }[] = [];
  const remaining = [...cands];
  const limit = Math.min(req.limit ?? 3, remaining.length);
  while (picked.length < limit) {
    let best: { c: Cand; D: number; score: number } | null = null;
    for (const c of remaining) {
      const maxSim = picked.length ? Math.max(...picked.map((p) => cosine(c.vec, p.c.vec))) : 0;
      let D = 1 - maxSim;
      if (picked.some((p) => normalize(p.c.w.creator) === normalize(c.w.creator))) D *= 0.5;
      const parts: [number, number][] = [[WEIGHTS.S, c.S], [WEIGHTS.D, D], [WEIGHTS.N, c.N]];
      if (c.W !== null) parts.push([WEIGHTS.W, c.W]);
      if (c.C !== null) parts.push([WEIGHTS.C, c.C]);
      const wsum = parts.reduce((a, [w]) => a + w, 0);
      const score = parts.reduce((a, [w, v]) => a + w * v, 0) / wsum;
      if (!best || score > best.score + 1e-12 || (Math.abs(score - best.score) <= 1e-12 && c.w.id < best.c.w.id)) best = { c, D, score };
    }
    picked.push(best!);
    remaining.splice(remaining.indexOf(best!.c), 1);
  }

  // ── 5. explanations grounded in WorkTag rows and user input ──────────────
  const recs: Recommendation[] = picked.map(({ c, D, score }) => {
    const reasons: Reason[] = [];
    const shared = c.w.tags
      .filter((t) => seedVec.has(t.key))
      .map((t) => ({ key: t.key, contrib: t.weight * (seedVec.get(t.key) ?? 0) }))
      .sort((a, b) => b.contrib - a.contrib || a.key.localeCompare(b.key));
    for (const s of shared.slice(0, 2)) {
      const ev = tagEvidence.get(s.key)!;
      reasons.push({
        type: "shared_theme", tag: s.key, tagLabel: tagLabel(s.key), evidenceWorkId: ev.work.id, evidenceWorkTitle: ev.work.title,
        text: `${tagLabel(s.key)} — 「${ev.work.title}」에서 이어지는 결`,
      });
    }
    for (const t of whyTags) {
      if (c.vec.has(t.key) && reasons.filter((r) => r.type === "why_match").length < 1) {
        reasons.push({ type: "why_match", tag: t.key, tagLabel: tagLabel(t.key), evidenceText: t.phrase, text: `좋아한 이유 "${t.phrase}" ↔ ${tagLabel(t.key)}` });
      }
    }
    for (const t of collectionTags) {
      if (c.vec.has(t.key) && !reasons.some((r) => r.tag === t.key)) {
        reasons.push({ type: "curation_context", tag: t.key, tagLabel: tagLabel(t.key), evidenceText: t.phrase, text: `전시 문구 "${t.phrase}" ↔ 이 작품의 ${tagLabel(t.key)}` });
        break;
      }
    }
    if (!seedMedia.has(c.w.medium)) {
      reasons.push({ type: "cross_medium", text: `전시에 아직 없는 매체 — ${MEDIUM_KO[c.w.medium]}` });
    }
    const groundedReasons = reasons.filter((r) => r.type !== "cross_medium").length;
    return {
      workId: c.w.id,
      title: c.w.title,
      creator: c.w.creator,
      medium: c.w.medium,
      releaseYear: c.w.releaseYear,
      coverTone: c.w.coverTone,
      artwork: c.w.artwork,
      score: round(score),
      scoreBreakdown: { semantic: round(c.S), why: c.W === null ? null : round(c.W), theme: c.C === null ? null : round(c.C), diversity: round(D), discovery: round(c.N) },
      matchedTags: shared.map((s) => s.key),
      reasons,
      provenance: "curated_metadata",
      source: c.w.source.name,
      confidenceLabel: groundedReasons >= 2 && score >= 0.4 ? "editorially_matched" : "exploratory",
    };
  });

  const fallbackUsed = recs.length > 0 && recs.every((r) => r.matchedTags.length === 0);

  if (opts.log !== false) {
    const ins = db.prepare(
      "INSERT INTO recommendation_events (id, user_id, exhibition_id, seed_work_ids_json, candidate_work_id, score, score_breakdown_json, model_version, action, created_at) VALUES (?,?,?,?,?,?,?,?, 'EXPOSED', ?)",
    );
    for (const r of recs) ins.run(newId("rev"), actor.userId, req.exhibitionId ?? null, JSON.stringify(seedIds), r.workId, r.score, JSON.stringify(r.scoreBreakdown), ALGORITHM_VERSION, nowIso());
  }

  return {
    recommendations: recs,
    algorithmVersion: ALGORITHM_VERSION,
    fallbackUsed,
    excludedSeedIds: [...excluded],
    seeds: seeds.map((s) => ({ workId: s.id, title: s.title, medium: s.medium })),
    appliedReasons: whyTags.map((t) => ({ key: t.key, label: tagLabel(t.key), from: t.phrase })),
    collectionTags: collectionTags.map((t) => ({ key: t.key, label: tagLabel(t.key), from: t.phrase })),
  };
}
