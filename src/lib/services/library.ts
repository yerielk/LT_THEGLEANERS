import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, newId, type Db } from "../db";
import { collectionItems, collections, exhibitions, likes, works } from "../schema";
import { LectaError } from "./errors";
import type { Actor } from "./actor";
import { zodMessage } from "../validators";
import { getWorksByIds, type WorkView } from "./works";
import { getExhibition, type ExhibitionView } from "./exhibitions";

/**
 * Likes and saved shelves. A like says "this is my taste" and feeds recommendations and popularity;
 * a save keeps something to come back to. Saves go to the person's default shelf, which can be renamed.
 */
export const DEFAULT_SHELF_NAME = "보관함";
export type TargetType = "WORK" | "CURATION";

const targetSchema = z.object({
  targetType: z.enum(["WORK", "CURATION"]),
  targetId: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9_\-]+$/, "invalid id"),
});
const nameSchema = z.object({ name: z.string().trim().min(1, "이름을 적어 주세요").max(40, "이름은 40자까지예요") });

function requireUser(actor: Actor): string {
  if (!actor.userId) throw new LectaError("UNAUTHORIZED", "Sign in to like or save.");
  return actor.userId;
}

async function parseTarget(input: unknown, actor: Actor, db: Db) {
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const { targetType, targetId } = parsed.data;
  if (targetType === "WORK") {
    const [row] = await db.select({ id: works.id }).from(works).where(eq(works.id, targetId));
    if (!row) throw new LectaError("WORK_NOT_FOUND", `No work with id "${targetId}"`);
  } else {
    await getExhibition(targetId, actor, db); // throws when missing or not readable by this person
  }
  return parsed.data;
}

async function defaultShelf(db: Db, userId: string) {
  const [existing] = await db.select().from(collections).where(and(eq(collections.userId, userId), eq(collections.isDefault, true)));
  if (existing) return existing;
  const [created] = await db.insert(collections).values({ id: newId("col"), userId, name: DEFAULT_SHELF_NAME, isDefault: true }).returning();
  return created;
}

export async function likeCount(targetType: TargetType, targetId: string, db: Db = getDb()): Promise<number> {
  const [row] = await db.select({ n: count() }).from(likes).where(and(eq(likes.targetType, targetType), eq(likes.targetId, targetId)));
  return row?.n ?? 0;
}

export async function toggleLike(input: unknown, actor: Actor, db: Db = getDb()): Promise<{ liked: boolean; likes: number }> {
  const userId = requireUser(actor);
  const { targetType, targetId } = await parseTarget(input, actor, db);
  const mine = and(eq(likes.userId, userId), eq(likes.targetType, targetType), eq(likes.targetId, targetId));
  const removed = await db.delete(likes).where(mine).returning({ id: likes.targetId });
  if (!removed.length) await db.insert(likes).values({ userId, targetType, targetId }).onConflictDoNothing();
  return { liked: !removed.length, likes: await likeCount(targetType, targetId, db) };
}

export async function toggleSave(input: unknown, actor: Actor, db: Db = getDb()): Promise<{ saved: boolean; shelf: { id: string; name: string } }> {
  const userId = requireUser(actor);
  const { targetType, targetId } = await parseTarget(input, actor, db);
  const shelf = await defaultShelf(db, userId);
  const mine = and(eq(collectionItems.collectionId, shelf.id), eq(collectionItems.targetType, targetType), eq(collectionItems.targetId, targetId));
  const removed = await db.delete(collectionItems).where(mine).returning({ id: collectionItems.targetId });
  if (!removed.length) await db.insert(collectionItems).values({ collectionId: shelf.id, targetType, targetId }).onConflictDoNothing();
  return { saved: !removed.length, shelf: { id: shelf.id, name: shelf.name } };
}

export async function renameShelf(id: string, input: unknown, actor: Actor, db: Db = getDb()): Promise<{ id: string; name: string }> {
  const userId = requireUser(actor);
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const [row] = await db.update(collections).set({ name: parsed.data.name }).where(and(eq(collections.id, id), eq(collections.userId, userId))).returning();
  if (!row) throw new LectaError("VALIDATION_ERROR", "No such shelf");
  return { id: row.id, name: row.name };
}

/** What the buttons need for one thing: is it liked, is it saved, and how many people like it. */
export async function reactionState(targetType: TargetType, targetId: string, actor: Actor, db: Db = getDb()) {
  const total = await likeCount(targetType, targetId, db);
  if (!actor.userId) return { liked: false, saved: false, likes: total, canReact: false };
  const [[liked], saved] = await Promise.all([
    db.select({ id: likes.targetId }).from(likes).where(and(eq(likes.userId, actor.userId), eq(likes.targetType, targetType), eq(likes.targetId, targetId))),
    db.select({ id: collectionItems.targetId }).from(collectionItems).innerJoin(collections, eq(collections.id, collectionItems.collectionId))
      .where(and(eq(collections.userId, actor.userId), eq(collectionItems.targetType, targetType), eq(collectionItems.targetId, targetId))),
  ]);
  return { liked: !!liked, saved: saved.length > 0, likes: total, canReact: true };
}

/** Works a person liked, newest first. Used as taste seeds next to the onboarding picks. */
export async function likedWorkIds(userId: string, db: Db = getDb(), limit = 32): Promise<string[]> {
  const rows = await db.select({ id: likes.targetId }).from(likes).where(and(eq(likes.userId, userId), eq(likes.targetType, "WORK"))).orderBy(desc(likes.createdAt)).limit(limit);
  return rows.map((r) => r.id);
}

/** Like counts for many curations at once, for ranking. */
export async function curationLikeCounts(ids: string[], db: Db = getDb()): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: likes.targetId, n: count() }).from(likes).where(and(eq(likes.targetType, "CURATION"), inArray(likes.targetId, ids))).groupBy(likes.targetId);
  return new Map(rows.map((r) => [r.id, r.n]));
}

export interface LibraryView {
  shelves: { id: string; name: string; isDefault: boolean; works: WorkView[]; curations: ExhibitionView[] }[];
  liked: { works: WorkView[]; curations: ExhibitionView[] };
}

async function resolve(rows: { targetType: TargetType; targetId: string }[], actor: Actor, db: Db) {
  const workList = await getWorksByIds(rows.filter((r) => r.targetType === "WORK").map((r) => r.targetId), db);
  const byId = new Map(workList.map((w) => [w.id, w]));
  const curationIds = rows.filter((r) => r.targetType === "CURATION").map((r) => r.targetId);
  const existing = curationIds.length ? await db.select({ id: exhibitions.id }).from(exhibitions).where(inArray(exhibitions.id, curationIds)) : [];
  const alive = new Set(existing.map((r) => r.id));
  const curations: ExhibitionView[] = [];
  for (const id of curationIds) {
    if (!alive.has(id)) continue;
    // a saved curation that has since gone private is simply left out
    try { curations.push(await getExhibition(id, actor, db)); } catch { /* not readable any more */ }
  }
  return { works: rows.filter((r) => r.targetType === "WORK").map((r) => byId.get(r.targetId)).filter((w): w is WorkView => !!w), curations };
}

export async function getLibrary(actor: Actor, db: Db = getDb()): Promise<LibraryView> {
  if (!actor.userId) return { shelves: [], liked: { works: [], curations: [] } };
  const shelfRows = await db.select().from(collections).where(eq(collections.userId, actor.userId)).orderBy(desc(collections.isDefault), collections.createdAt);
  const shelves = [];
  for (const shelf of shelfRows) {
    const items = await db.select().from(collectionItems).where(eq(collectionItems.collectionId, shelf.id)).orderBy(desc(collectionItems.createdAt));
    shelves.push({ id: shelf.id, name: shelf.name, isDefault: shelf.isDefault, ...(await resolve(items, actor, db)) });
  }
  const likedRows = await db.select().from(likes).where(eq(likes.userId, actor.userId)).orderBy(desc(likes.createdAt)).limit(60);
  return { shelves, liked: await resolve(likedRows, actor, db) };
}
