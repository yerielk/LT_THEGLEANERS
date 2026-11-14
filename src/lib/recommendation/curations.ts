import { getDb, type Db } from "../db";
import { allWorks, getWorksByIds, type WorkView } from "../services/works";
import { listMine, listVisibleForRecommendations, type ExhibitionView } from "../services/exhibitions";
import type { Actor } from "../services/actor";
import { TAG_BY_KEY, extractTagsFromText } from "./tags";

export type CurationMatch = "included_work" | "keyword" | "content_similarity";
type RecommendationWork = Pick<WorkView, "id" | "title" | "creator" | "medium" | "releaseYear" | "coverTone" | "artwork">;
export interface CurationRecommendation {
  id: string;
  number: number;
  title: string;
  description: string | null;
  visibility: "DRAFT" | "PRIVATE" | "PUBLIC";
  match: CurationMatch;
  reasons: string[];
  works: RecommendationWork[];
}

type TagWeights = Map<string, number>;

function tagWeights(work: WorkView): TagWeights {
  const unique = new Map<string, number>();
  for (const tag of work.tags) unique.set(tag.key, Math.max(unique.get(tag.key) ?? 0, Math.max(0, Math.min(1, tag.weight))));
  return unique;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const key of left) if (right.has(key)) intersection++;
  return intersection / union.size;
}

function personalOverlap(candidate: Set<string>, personal: Set<string>): number {
  return jaccard(candidate, personal);
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index++) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return 0;
  return Math.max(0, Math.min(1, dot / Math.sqrt(leftNorm * rightNorm)));
}

async function requestEmbeddings(url: string, model: string, input: string[]): Promise<number[][] | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, input }),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const raw = (payload as { embeddings?: unknown }).embeddings;
    if (!Array.isArray(raw) || raw.length !== input.length) return null;
    if (!raw.every((vector) => Array.isArray(vector) && vector.length > 0 && vector.every((value) => typeof value === "number" && Number.isFinite(value)))) return null;
    const vectors = raw as number[][];
    const dimensions = vectors[0].length;
    return vectors.every((vector) => vector.length === dimensions) ? vectors : null;
  } catch {
    return null;
  }
}

function embeddingText(curation: ExhibitionView): string {
  const worksText = curation.items.map(({ work }) => {
    const tags = [...tagWeights(work).keys()].map((key) => TAG_BY_KEY[key]?.ko ?? key).join(" ");
    return [work.title, work.originalTitle, work.creator, work.medium, work.releaseYear, tags].filter(Boolean).join(" ");
  }).join("\n");
  return [curation.title, curation.description, worksText].filter(Boolean).join("\n");
}

function reasonsFor(keys: string[], matchedWorks: number) {
  const reasons: string[] = [];
  if (matchedWorks) {
    const labels = keys.map((key) => TAG_BY_KEY[key]?.ko).filter(Boolean).slice(0, 3);
    reasons.push(`${labels.join("·")} 분위기 태그가 ${matchedWorks}개 작품에 연결돼 있어요.`);
  }
  reasons.push("선택한 작품이 포함돼 있어요.");
  return reasons;
}

/** Search-context curation ranking based only on the controlled work-tag vocabulary. */
export async function recommendCurations(input: { q?: string; workIds?: string[]; limit?: number }, actor: Actor, db: Db = getDb()) {
  const q = (input.q ?? "").trim().slice(0, 80);
  const workIds = [...new Set((input.workIds ?? []).slice(0, 8))];
  const searchTagKeys = [...new Set(extractTagsFromText(q).map((match) => match.key))];
  if (!workIds.length) return { recommendations: [], embeddingAvailable: false };

  const [selectedWorks, catalog, views, personalCurations] = await Promise.all([
    getWorksByIds(workIds, db),
    allWorks(db),
    listVisibleForRecommendations(actor, db),
    actor.userId ? listMine(actor, db) : Promise.resolve([]),
  ]);
  const selected = new Set(selectedWorks.map((work) => work.id));
  if (!selected.size) return { recommendations: [], embeddingAvailable: false };
  // If free text has no controlled tag match, use the selected works' existing tags.
  const queryTagKeys = searchTagKeys.length
    ? searchTagKeys
    : [...new Set(selectedWorks.flatMap((work) => [...tagWeights(work).keys()]))];
  if (!queryTagKeys.length) return { recommendations: [], embeddingAvailable: false };

  const documentFrequency = new Map<string, number>();
  for (const work of catalog) {
    for (const key of tagWeights(work).keys()) documentFrequency.set(key, (documentFrequency.get(key) ?? 0) + 1);
  }
  const workCount = catalog.length;
  const rarity = new Map(queryTagKeys.map((key) => {
    const frequency = documentFrequency.get(key) ?? 0;
    const idf = workCount ? Math.log((workCount + 1) / (frequency + 1)) / Math.log(workCount + 1) : 0;
    return [key, Math.max(0, Math.min(1, idf))];
  }));
  const rarityTotal = [...rarity.values()].reduce((sum, value) => sum + value, 0);
  if (!rarityTotal) return { recommendations: [], embeddingAvailable: false };

  const personalWorkIds = new Set(personalCurations.flatMap((curation) => curation.items.map((item) => item.workId)));
  const candidates = views.filter((curation) => curation.items.length > 0).flatMap((curation) => {
    const curationWorkIds = new Set(curation.items.map((item) => item.workId));
    const includedWorkCount = [...selected].filter((id) => curationWorkIds.has(id)).length;
    if (!includedWorkCount) return [];

    let totalWorkFit = 0;
    let matchedWorks = 0;
    for (const item of curation.items) {
      const weights = tagWeights(item.work);
      let workFit = 0;
      let hasQueryTag = false;
      for (const key of queryTagKeys) {
        const weight = weights.get(key) ?? 0;
        if (weight > 0) hasQueryTag = true;
        workFit += (rarity.get(key) ?? 0) * weight;
      }
      totalWorkFit += workFit / rarityTotal;
      if (hasQueryTag) matchedWorks++;
    }

    // Average per-work relevance once, so larger curations do not receive an extra penalty.
    const tagFit = totalWorkFit / curation.items.length;
    const tagCoverage = matchedWorks / curation.items.length;
    if (tagFit <= 0 || tagCoverage <= 0) return [];
    const overlap = personalOverlap(curationWorkIds, personalWorkIds);
    const score = 0.6 * tagFit + 0.3 * tagCoverage + 0.1 * overlap;
    return [{ curation, score, matchedWorks }];
  });

  const embeddingUrl = process.env.LECTA_EMBEDDING_URL?.trim();
  const embeddingModel = process.env.LECTA_EMBEDDING_MODEL?.trim();
  let embeddingAvailable = false;
  let rankedCandidates = candidates;
  if (embeddingUrl && embeddingModel && candidates.length) {
    const embeddingQuery = q || queryTagKeys.map((key) => TAG_BY_KEY[key]?.ko ?? key).join(" ");
    const embeddings = await requestEmbeddings(embeddingUrl, embeddingModel, [
      embeddingQuery,
      ...candidates.map(({ curation }) => embeddingText(curation)),
    ]);
    if (embeddings) {
      embeddingAvailable = true;
      const queryEmbedding = embeddings[0];
      rankedCandidates = candidates.flatMap((candidate, index) => {
        const contentSimilarity = cosineSimilarity(queryEmbedding, embeddings[index + 1]);
        // An orthogonal or opposing vector contributes no semantic evidence and is not surfaced.
        if (contentSimilarity <= 0) return [];
        return [{
          ...candidate,
          score: candidate.score * 0.85 + contentSimilarity * 0.15,
        }];
      });
    }
  }
  rankedCandidates.sort((a, b) => b.score - a.score || a.curation.id.localeCompare(b.curation.id));

  const cap = Math.max(1, Math.min(input.limit ?? 6, 6));
  return {
    recommendations: rankedCandidates.slice(0, cap).map(({ curation, matchedWorks }) => ({
      id: curation.id,
      number: curation.number,
      title: curation.title,
      description: curation.description,
      visibility: curation.visibility,
      match: "included_work" as const,
      reasons: reasonsFor(queryTagKeys, matchedWorks),
      workCount: curation.items.length,
      works: curation.items.slice(0, 4).map(({ work }) => ({
        id: work.id, title: work.title, creator: work.creator, medium: work.medium,
        releaseYear: work.releaseYear, coverTone: work.coverTone, artwork: work.artwork,
      })),
    })),
    embeddingAvailable,
  };
}
