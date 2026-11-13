import { and, asc, count, desc, eq, inArray, max, ne, or, sql } from "drizzle-orm";
import { getDb, newId, type Db } from "../db";
import { exhibitionItems, exhibitions, recommendationEvents, tasteSignals, user } from "../schema";
import { LectaError } from "./errors";
import type { Actor } from "./actor";
import { getWorksByIds, type WorkView } from "./works";
import { createExhibitionSchema, patchExhibitionSchema, addItemSchema, zodMessage, type CreateExhibitionInput } from "../validators";
import { extractTagsFromText, normalize } from "../recommendation/tags";
import { queryTagWeights } from "../recommendation/search-tags";

export type Visibility = "DRAFT" | "PRIVATE" | "PUBLIC";

export interface ExhibitionItemView {
  workId: string;
  position: number;
  curatorNote: string | null;
  work: WorkView;
}

export interface ExhibitionView {
  id: string;
  number: number;
  title: string;
  description: string | null;
  visibility: Visibility;
  layoutTemplate: string;
  isEditorial: boolean;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: ExhibitionItemView[];
}

type Row = typeof exhibitions.$inferSelect;

function canRead(row: Row, actor: Actor) {
  return row.visibility === "PUBLIC" || (actor.userId !== null && row.ownerId === actor.userId);
}

async function load(db: Db, row: Row, actor: Actor): Promise<ExhibitionView> {
  const items = await db
    .select()
    .from(exhibitionItems)
    .where(eq(exhibitionItems.exhibitionId, row.id))
    .orderBy(asc(exhibitionItems.position), asc(exhibitionItems.id));
  const [workList, [owner]] = await Promise.all([
    getWorksByIds(items.map((i) => i.workId), db),
    db.select({ name: user.name }).from(user).where(eq(user.id, row.ownerId)),
  ]);
  const works = new Map(workList.map((w) => [w.id, w]));
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    layoutTemplate: row.layoutTemplate,
    isEditorial: row.isEditorial,
    ownerId: row.ownerId,
    ownerName: owner?.name ?? "unknown",
    isOwner: actor.userId !== null && actor.userId === row.ownerId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: items
      .filter((i) => works.has(i.workId))
      .map((i) => ({ workId: i.workId, position: i.position, curatorNote: i.curatorNote, work: works.get(i.workId)! })),
  };
}

async function rowOrThrow(db: Db, id: string): Promise<Row> {
  const [row] = await db.select().from(exhibitions).where(eq(exhibitions.id, id));
  if (!row) throw new LectaError("EXHIBITION_NOT_FOUND", `No exhibition with id "${id}"`);
  return row;
}

export async function getExhibition(id: string, actor: Actor, db: Db = getDb()): Promise<ExhibitionView> {
  const row = await rowOrThrow(db, id);
  // A private draft is reported as "not found" to non-owners would leak less, but the spec asks for an
  // explicit permission failure so agents can tell the two apart.
  if (!canRead(row, actor)) {
    throw new LectaError(actor.userId ? "FORBIDDEN" : "UNAUTHORIZED", "This exhibition is a private draft. Only its owner can read it.");
  }
  return load(db, row, actor);
}

export async function listFeatured(actor: Actor, db: Db = getDb()): Promise<ExhibitionView[]> {
  const rows = await db.select().from(exhibitions).where(eq(exhibitions.visibility, "PUBLIC")).orderBy(asc(exhibitions.number));
  return Promise.all(rows.map((r) => load(db, r, actor)));
}

/** Bulk-loads only exhibitions the actor may read, avoiding one query group per candidate in Discover. */
export async function listVisibleForRecommendations(actor: Actor, db: Db = getDb()): Promise<ExhibitionView[]> {
  const rows = await db.select().from(exhibitions).where(actor.userId
    ? or(eq(exhibitions.visibility, "PUBLIC"), eq(exhibitions.ownerId, actor.userId))
    : eq(exhibitions.visibility, "PUBLIC")).orderBy(asc(exhibitions.id));
  const visible = rows.filter((row) => canRead(row, actor));
  if (!visible.length) return [];

  const ids = visible.map((row) => row.id);
  const itemRows = await db.select().from(exhibitionItems).where(inArray(exhibitionItems.exhibitionId, ids))
    .orderBy(asc(exhibitionItems.position), asc(exhibitionItems.id));
  const itemWorkIds = [...new Set(itemRows.map((item) => item.workId))];
  const workList = await getWorksByIds(itemWorkIds, db);
  const worksById = new Map(workList.map((work) => [work.id, work]));
  const ownerIds = [...new Set(visible.map((row) => row.ownerId))];
  const owners = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ownerIds));
  const ownerNames = new Map(owners.map((owner) => [owner.id, owner.name]));
  const itemsByExhibition = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByExhibition.get(item.exhibitionId) ?? [];
    list.push(item);
    itemsByExhibition.set(item.exhibitionId, list);
  }

  return visible.map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    layoutTemplate: row.layoutTemplate,
    isEditorial: row.isEditorial,
    ownerId: row.ownerId,
    ownerName: ownerNames.get(row.ownerId) ?? "unknown",
    isOwner: actor.userId !== null && actor.userId === row.ownerId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: (itemsByExhibition.get(row.id) ?? []).filter((item) => worksById.has(item.workId)).map((item) => ({
      workId: item.workId,
      position: item.position,
      curatorNote: item.curatorNote,
      work: worksById.get(item.workId)!,
    })),
  }));
}

function curationTagSearchScore(exhibition: ExhibitionView, queryTags: Map<string, number>, queryWeightTotal: number): { fit: number; coverage: number } {
  if (!exhibition.items.length || !queryWeightTotal) return { fit: 0, coverage: 0 };
  const tagMax = new Map<string, number>();
  const tagWorkCounts = new Map<string, number>();
  for (const item of exhibition.items) {
    const workTags = new Map<string, number>();
    for (const tag of item.work.tags) workTags.set(tag.key, Math.max(workTags.get(tag.key) ?? 0, tag.weight));
    for (const [key, weight] of workTags) {
      tagMax.set(key, Math.max(tagMax.get(key) ?? 0, weight));
      tagWorkCounts.set(key, (tagWorkCounts.get(key) ?? 0) + 1);
    }
  }

  let fit = 0;
  let coverage = 0;
  for (const [key, queryWeight] of queryTags) {
    fit += queryWeight * (tagMax.get(key) ?? 0);
    coverage += queryWeight * ((tagWorkCounts.get(key) ?? 0) / exhibition.items.length);
  }
  return { fit: fit / queryWeightTotal, coverage: coverage / queryWeightTotal };
}

function personalCurationOverlap(workIds: Set<string>, personalWorkIds: Set<string>): number {
  if (!workIds.size || !personalWorkIds.size) return 0;
  let intersection = 0;
  for (const workId of workIds) if (personalWorkIds.has(workId)) intersection++;
  const union = workIds.size + personalWorkIds.size - intersection;
  return union ? intersection / union : 0;
}

/** Rank every readable curation by tag similarity; never drop results by a minimum score. */
export async function searchVisibleExhibitions(query: string, actor: Actor, db: Db = getDb()): Promise<ExhibitionView[]> {
  if (!normalize(query).trim()) return [];
  const queryTags = queryTagWeights(query);
  const queryWeightTotal = [...queryTags.values()].reduce((sum, weight) => sum + weight, 0);
  const [exhibitions, personalCurations] = await Promise.all([
    listVisibleForRecommendations(actor, db),
    actor.userId ? listMine(actor, db) : Promise.resolve([]),
  ]);
  const personalWorkIds = new Set(personalCurations.flatMap((curation) => curation.items.map((item) => item.workId)));

  return exhibitions.map((exhibition) => {
    const workIds = new Set(exhibition.items.map((item) => item.workId));
    const { fit, coverage } = curationTagSearchScore(exhibition, queryTags, queryWeightTotal);
    const overlap = personalCurationOverlap(workIds, personalWorkIds);
    return { exhibition, score: 0.6 * fit + 0.3 * coverage + 0.1 * overlap };
  }).sort((a, b) => b.score - a.score || a.exhibition.number - b.exhibition.number || a.exhibition.id.localeCompare(b.exhibition.id))
    .map(({ exhibition }) => exhibition);
}

export async function listMine(actor: Actor, db: Db = getDb()): Promise<ExhibitionView[]> {
  if (!actor.userId) return [];
  const rows = await db.select().from(exhibitions).where(eq(exhibitions.ownerId, actor.userId)).orderBy(desc(exhibitions.createdAt), asc(exhibitions.id));
  return Promise.all(rows.map((r) => load(db, r, actor)));
}

function requireWriter(actor: Actor): string {
  if (!actor.userId) throw new LectaError("UNAUTHORIZED", "Writing requires signing in (or DEMO_MODE=true locally), or a personal MCP key.");
  return actor.userId;
}

async function assertWorksExist(db: Db, ids: string[]) {
  const found = new Set((await getWorksByIds(ids, db)).map((w) => w.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new LectaError("WORK_NOT_FOUND", `Unknown work id(s): ${missing.join(", ")}`, false, { missing });
}

async function recordCurationSignals(db: Db, userId: string, exhibitionId: string, notes: { workId: string; note: string | null }[], origin: "USER_EXPLICIT" | "MODEL_SUGGESTED") {
  if (!notes.length) return;
  await db.insert(tasteSignals).values(
    notes.map((n) => {
      const tags = n.note ? extractTagsFromText(n.note).map((m) => m.key) : [];
      return { id: newId("sig"), userId, workId: n.workId, exhibitionId, signalType: "CURATED" as const, whyText: n.note, structuredTags: tags.length ? tags : null, origin };
    }),
  );
}

export interface CreateResult {
  exhibition: ExhibitionView;
  created: boolean; // false when an identical requestId was replayed
}

export async function createExhibition(
  input: unknown,
  actor: Actor,
  opts: { origin?: "USER_EXPLICIT" | "MODEL_SUGGESTED" } = {},
  db: Db = getDb(),
): Promise<CreateResult> {
  const parsed = createExhibitionSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const data: CreateExhibitionInput = parsed.data;
  const userId = requireWriter(actor);

  if (new Set(data.workIds).size !== data.workIds.length) throw new LectaError("VALIDATION_ERROR", "workIds contains duplicates");
  const noteWork = (data.curatorNotes ?? []).find((n) => !data.workIds.includes(n.workId));
  if (noteWork) throw new LectaError("VALIDATION_ERROR", `curatorNotes refers to ${noteWork.workId}, which is not in workIds`);

  if (data.requestId) {
    const [prior] = await db.select().from(exhibitions).where(and(eq(exhibitions.ownerId, userId), eq(exhibitions.requestKey, data.requestId)));
    if (prior) return { exhibition: await load(db, prior, actor), created: false };
  }
  await assertWorksExist(db, data.workIds);

  const id = newId("ex");
  const notes = new Map((data.curatorNotes ?? []).map((n) => [n.workId, n.note || null]));
  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: max(exhibitions.number) }).from(exhibitions);
    await tx.insert(exhibitions).values({
      id, ownerId: userId, title: data.title, description: data.description || null, visibility: "DRAFT",
      number: (n ?? 0) + 1, requestKey: data.requestId ?? null, version: 1,
    });
    await tx.insert(exhibitionItems).values(data.workIds.map((w, i) => ({ id: newId("exi"), exhibitionId: id, workId: w, position: i, curatorNote: notes.get(w) ?? null })));
    await recordCurationSignals(tx, userId, id, data.workIds.map((w) => ({ workId: w, note: notes.get(w) ?? null })), opts.origin ?? "USER_EXPLICIT");
  });
  return { exhibition: await getExhibition(id, actor, db), created: true };
}

export async function updateExhibition(id: string, input: unknown, actor: Actor, db: Db = getDb()): Promise<ExhibitionView> {
  const parsed = patchExhibitionSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const userId = requireWriter(actor);
  const row = await rowOrThrow(db, id);
  if (row.ownerId !== userId) throw new LectaError("FORBIDDEN", "Only the owner can edit this exhibition.");
  const p = parsed.data;
  if (p.expectedVersion && p.expectedVersion !== row.version) {
    throw new LectaError("CONFLICT", "This exhibition changed since you opened it. Reload and try again.", false, { currentVersion: row.version });
  }
  if (p.items) {
    const ids = p.items.map((i) => i.workId);
    if (new Set(ids).size !== ids.length) throw new LectaError("VALIDATION_ERROR", "items contains duplicate works");
    await assertWorksExist(db, ids);
  }
  await db.transaction(async (tx) => {
    await tx.update(exhibitions).set({
      title: p.title ?? row.title,
      description: p.description !== undefined ? p.description || null : row.description,
      version: sql`${exhibitions.version} + 1`,
      updatedAt: new Date(),
    }).where(eq(exhibitions.id, id));
    if (p.items) {
      await tx.delete(exhibitionItems).where(eq(exhibitionItems.exhibitionId, id));
      await tx.insert(exhibitionItems).values(p.items.map((it, i) => ({ id: newId("exi"), exhibitionId: id, workId: it.workId, position: i, curatorNote: it.curatorNote || null })));
    }
  });
  return getExhibition(id, actor, db);
}

export async function addItem(id: string, input: unknown, actor: Actor, db: Db = getDb()): Promise<ExhibitionView> {
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const userId = requireWriter(actor);
  const row = await rowOrThrow(db, id);
  if (row.ownerId !== userId) throw new LectaError("FORBIDDEN", "Only the owner can add works to this exhibition.");
  const { workId, curatorNote, fromRecommendation, score } = parsed.data;
  await assertWorksExist(db, [workId]);
  const [dup] = await db.select({ id: exhibitionItems.id }).from(exhibitionItems).where(and(eq(exhibitionItems.exhibitionId, id), eq(exhibitionItems.workId, workId)));
  if (dup) throw new LectaError("CONFLICT", "This work is already in the exhibition.");
  const [{ n }] = await db.select({ n: count() }).from(exhibitionItems).where(eq(exhibitionItems.exhibitionId, id));
  if (n >= 16) throw new LectaError("VALIDATION_ERROR", "An exhibition can hold at most 16 works.");
  await db.transaction(async (tx) => {
    const [{ p }] = await tx.select({ p: max(exhibitionItems.position) }).from(exhibitionItems).where(eq(exhibitionItems.exhibitionId, id));
    await tx.insert(exhibitionItems).values({ id: newId("exi"), exhibitionId: id, workId, position: (p ?? -1) + 1, curatorNote: curatorNote || null });
    await tx.update(exhibitions).set({ version: sql`${exhibitions.version} + 1`, updatedAt: new Date() }).where(eq(exhibitions.id, id));
    if (fromRecommendation) {
      const seeds = await tx.select({ workId: exhibitionItems.workId }).from(exhibitionItems)
        .where(and(eq(exhibitionItems.exhibitionId, id), ne(exhibitionItems.workId, workId))).orderBy(asc(exhibitionItems.position));
      await tx.insert(recommendationEvents).values({
        id: newId("rev"), userId, exhibitionId: id, seedWorkIds: seeds.map((s) => s.workId), candidateWorkId: workId,
        score: score ?? 0, scoreBreakdown: {}, modelVersion: "coldstart-v1", action: "ADDED",
      });
      await tx.insert(tasteSignals).values({ id: newId("sig"), userId, workId, exhibitionId: id, signalType: "RECOMMENDATION_ADDED", origin: "USER_EXPLICIT" });
    }
  });
  return getExhibition(id, actor, db);
}
