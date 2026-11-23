import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb, type Db } from "../db";
import { exhibitionItems, works, workTags } from "../schema";
import { extractTagsFromText, TAGS } from "../recommendation/tags";

/**
 * Works that come in from an outside source arrive without taste tags, and the recommender only sees tags.
 * Until a person reviews them, tags are inferred from three kinds of evidence, each weaker than a curated tag:
 *   1. words in the title and synopsis that match the tag vocabulary,
 *   2. tags of other works by the same creator,
 *   3. tags of the works it has been placed next to in curations.
 * Inferred tags are stored with provenance EXTERNAL and reviewed=false, never over curated ones,
 * and are recomputed whenever new evidence arrives.
 */
const TEXT_WEIGHT = 0.35;
const CREATOR_SCALE = 0.6;
const NEIGHBOUR_SCALE = 0.5;
const MIN_WEIGHT = 0.2;
const MAX_TAGS = 6;
const CATEGORY = new Map(TAGS.map((t) => [t.key, t.category]));

type Evidence = { weight: number; why: string };

export async function inferTags(workId: string, db: Db = getDb()): Promise<{ key: string; weight: number; why: string }[]> {
  const [work] = await db.select().from(works).where(eq(works.id, workId));
  if (!work) return [];
  const found = new Map<string, Evidence>();
  const offer = (key: string, weight: number, why: string) => {
    if (!CATEGORY.has(key)) return;
    const cur = found.get(key);
    if (!cur || weight > cur.weight) found.set(key, { weight, why });
  };

  for (const match of extractTagsFromText(`${work.title} ${work.originalTitle ?? ""} ${work.synopsis ?? ""}`)) offer(match.key, TEXT_WEIGHT, `text: ${match.phrase}`);

  const average = (rows: { key: string; weight: number; workId: string }[]) => {
    const owners = new Set(rows.map((r) => r.workId)).size;
    const sums = new Map<string, number>();
    for (const r of rows) sums.set(r.key, (sums.get(r.key) ?? 0) + r.weight);
    return [...sums].map(([key, sum]) => ({ key, weight: sum / owners }));
  };
  const curatedTagsOf = (ids: string[]) => ids.length
    ? db.select({ key: workTags.tagKey, weight: workTags.weight, workId: workTags.workId }).from(workTags)
        .where(and(inArray(workTags.workId, ids), eq(workTags.provenance, "HUMAN_CURATED")))
    : Promise.resolve([]);

  if (work.creator.trim()) {
    const siblings = await db.select({ id: works.id }).from(works).where(and(eq(works.creator, work.creator), ne(works.id, workId))).limit(40);
    for (const t of average(await curatedTagsOf(siblings.map((s) => s.id)))) offer(t.key, t.weight * CREATOR_SCALE, "same creator");
  }

  const rooms = await db.select({ id: exhibitionItems.exhibitionId }).from(exhibitionItems).where(eq(exhibitionItems.workId, workId)).limit(40);
  if (rooms.length) {
    const neighbours = await db.select({ id: exhibitionItems.workId }).from(exhibitionItems)
      .where(and(inArray(exhibitionItems.exhibitionId, rooms.map((r) => r.id)), ne(exhibitionItems.workId, workId))).limit(200);
    for (const t of average(await curatedTagsOf([...new Set(neighbours.map((n) => n.id))]))) offer(t.key, t.weight * NEIGHBOUR_SCALE, "curated alongside");
  }

  return [...found].map(([key, e]) => ({ key, weight: Math.round(e.weight * 100) / 100, why: e.why }))
    .filter((t) => t.weight >= MIN_WEIGHT).sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key)).slice(0, MAX_TAGS);
}

/** Recomputes inferred tags for works that have no curated tags. Returns how many works now carry tags. */
export async function refreshInferredTags(workIds: string[], db: Db = getDb()): Promise<number> {
  const ids = [...new Set(workIds)];
  if (!ids.length) return 0;
  const curated = await db.select({ id: workTags.workId }).from(workTags).where(and(inArray(workTags.workId, ids), eq(workTags.provenance, "HUMAN_CURATED")));
  const skip = new Set(curated.map((r) => r.id));
  let tagged = 0;
  for (const id of ids) {
    if (skip.has(id)) continue;
    const tags = await inferTags(id, db);
    await db.transaction(async (tx) => {
      await tx.delete(workTags).where(and(eq(workTags.workId, id), eq(workTags.provenance, "EXTERNAL")));
      if (tags.length) {
        await tx.insert(workTags).values(tags.map((t) => ({
          id: `t_${id}_${t.key}`, workId: id, tagKey: t.key, category: CATEGORY.get(t.key)!, weight: t.weight,
          provenance: "EXTERNAL" as const, evidenceText: `inferred, ${t.why}`, reviewed: false,
        }))).onConflictDoNothing();
      }
    });
    if (tags.length) tagged++;
  }
  return tagged;
}

/** Every work without any tag. For the backfill script. */
export async function untaggedWorkIds(db: Db = getDb()): Promise<string[]> {
  const all = await db.select({ id: works.id }).from(works);
  const tagged = new Set((await db.selectDistinct({ id: workTags.workId }).from(workTags).where(eq(workTags.provenance, "HUMAN_CURATED"))).map((r) => r.id));
  return all.map((w) => w.id).filter((id) => !tagged.has(id));
}
