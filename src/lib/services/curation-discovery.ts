import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb, type Db } from "../db";
import { tasteSignals } from "../schema";
import { getWorksByIds, type WorkView } from "./works";
import { listFeatured, type ExhibitionView } from "./exhibitions";
import type { Actor } from "./actor";

const POPULAR_LIMIT = 6;
const SUGGESTED_LIMIT = 12;

function uniqueTagWeights(work: WorkView): Map<string, number> {
  const weights = new Map<string, number>();
  for (const tag of work.tags) weights.set(tag.key, Math.max(weights.get(tag.key) ?? 0, tag.weight));
  return weights;
}

function sample<T>(items: T[], limit: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, limit);
}

function tagConsistency(exhibition: ExhibitionView): number {
  if (exhibition.items.length < 2) return 0;
  let score = 0;
  let pairs = 0;
  for (let i = 0; i < exhibition.items.length; i++) {
    const left = uniqueTagWeights(exhibition.items[i].work);
    for (let j = i + 1; j < exhibition.items.length; j++) {
      const right = uniqueTagWeights(exhibition.items[j].work);
      const keys = new Set([...left.keys(), ...right.keys()]);
      let overlap = 0;
      let union = 0;
      for (const key of keys) {
        const a = left.get(key) ?? 0;
        const b = right.get(key) ?? 0;
        overlap += Math.min(a, b);
        union += Math.max(a, b);
      }
      score += union ? overlap / union : 0;
      pairs++;
    }
  }
  return pairs ? score / pairs : 0;
}

export async function getCurationDiscovery(actor: Actor, db: Db = getDb()) {
  const allCurations = await listFeatured(actor, db);
  const curations = allCurations.filter((curation) => curation.items.length > 0);
  const randomOrder = sample(curations, curations.length);
  const popular = randomOrder.slice(0, POPULAR_LIMIT);
  const popularIds = new Set(popular.map((curation) => curation.id));
  // There is no curation popularity metric. RecommendationEvents records work additions
  // to a user's target exhibition, so it is not a curation popularity signal.

  const archivedWorkIds = actor.userId
    ? await db.select({ workId: tasteSignals.workId }).from(tasteSignals)
      .where(and(eq(tasteSignals.userId, actor.userId), eq(tasteSignals.signalType, "SAVED"), isNotNull(tasteSignals.workId)))
      .orderBy(desc(tasteSignals.createdAt)).limit(200)
    : [];
  const savedIds = [...new Set(archivedWorkIds.map((row) => row.workId).filter((id): id is string => !!id))];
  const archivedWorks = savedIds.length ? await getWorksByIds(savedIds, db) : [];
  const profile = new Map<string, number>();
  for (const work of archivedWorks) {
    for (const [key, weight] of uniqueTagWeights(work)) profile.set(key, (profile.get(key) ?? 0) + Math.max(0, weight));
  }

  let suggested: ExhibitionView[] = [];
  if (profile.size) {
    const profileTotal = [...profile.values()].reduce((sum, weight) => sum + weight, 0);
    const weights = new Map([...profile].map(([key, weight]) => [key, profileTotal ? weight / profileTotal : 0]));
    const ranked = curations.map((curation) => {
      const curationTagWeights = new Map<string, number>();
      for (const item of curation.items) {
        for (const [key, weight] of uniqueTagWeights(item.work)) {
          curationTagWeights.set(key, Math.max(curationTagWeights.get(key) ?? 0, weight));
        }
      }
      let fit = 0;
      let coverage = 0;
      for (const [key, profileWeight] of weights) {
        const curationWeight = curationTagWeights.get(key) ?? 0;
        if (curationWeight > 0) coverage += profileWeight;
        fit += profileWeight * curationWeight;
      }
      return { curation, score: fit * 0.75 + coverage * 0.2 + tagConsistency(curation) * 0.05, coverage };
    }).filter((entry) => entry.coverage > 0 && !popularIds.has(entry.curation.id))
      .sort((a, b) => b.score - a.score || a.curation.id.localeCompare(b.curation.id));
    suggested = ranked.slice(0, SUGGESTED_LIMIT).map((entry) => entry.curation);
  }

  if (!suggested.length) {
    suggested = curations.filter((curation) => curation.isEditorial && !popularIds.has(curation.id))
      .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id)).slice(0, SUGGESTED_LIMIT);
  }

  const popularCard = ({ id, number, title, description, ownerName, updatedAt, items }: ExhibitionView) => ({
    id, number, title, description, ownerName, updatedAt,
    items: items.map(({ workId, work }) => ({
      workId,
      work: {
        id: work.id,
        title: work.title,
        originalTitle: work.originalTitle,
        creator: work.creator,
        medium: work.medium,
        releaseYear: work.releaseYear,
        coverTone: work.coverTone,
        artwork: work.artwork ? { url: work.artwork.url, width: work.artwork.width, height: work.artwork.height } : null,
      },
    })),
  });
  return {
    curations: allCurations.map(popularCard),
    // Keep one randomized order for the whole session so "더보기" can continue
    // the same list instead of switching to a differently ordered all-curations view.
    popularIds: randomOrder.map((curation) => curation.id),
    suggestedIds: suggested.map((curation) => curation.id),
  };
}
