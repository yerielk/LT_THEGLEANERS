import type { DatabaseSync } from "node:sqlite";
import { getDb, newId, nowIso, tx } from "../db";
import { LectaError } from "./errors";
import type { Actor } from "./actor";
import { getWorksByIds, type WorkView } from "./works";
import { createExhibitionSchema, patchExhibitionSchema, addItemSchema, zodMessage, type CreateExhibitionInput } from "../validators";
import { extractTagsFromText } from "../recommendation/tags";

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

type Row = Record<string, unknown>;

function canRead(row: Row, actor: Actor) {
  return row.visibility === "PUBLIC" || (actor.userId !== null && row.owner_id === actor.userId);
}

function load(db: DatabaseSync, row: Row, actor: Actor): ExhibitionView {
  const items = db
    .prepare("SELECT * FROM exhibition_items WHERE exhibition_id = ? ORDER BY position, id")
    .all(row.id as string) as Row[];
  const works = new Map(getWorksByIds(items.map((i) => i.work_id as string), db).map((w) => [w.id, w]));
  const owner = db.prepare("SELECT display_name FROM users WHERE id = ?").get(row.owner_id as string) as Row | undefined;
  return {
    id: row.id as string,
    number: row.number as number,
    title: row.title as string,
    description: (row.description as string) ?? null,
    visibility: row.visibility as Visibility,
    layoutTemplate: row.layout_template as string,
    isEditorial: row.is_editorial === 1,
    ownerId: row.owner_id as string,
    ownerName: (owner?.display_name as string) ?? "unknown",
    isOwner: actor.userId !== null && actor.userId === row.owner_id,
    version: row.version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    items: items
      .filter((i) => works.has(i.work_id as string))
      .map((i) => ({
        workId: i.work_id as string,
        position: i.position as number,
        curatorNote: (i.curator_note as string) ?? null,
        work: works.get(i.work_id as string)!,
      })),
  };
}

function rowOrThrow(db: DatabaseSync, id: string): Row {
  const row = db.prepare("SELECT * FROM exhibitions WHERE id = ?").get(id) as Row | undefined;
  if (!row) throw new LectaError("EXHIBITION_NOT_FOUND", `No exhibition with id "${id}"`);
  return row;
}

export function getExhibition(id: string, actor: Actor, db: DatabaseSync = getDb()): ExhibitionView {
  const row = rowOrThrow(db, id);
  // A private draft is reported as "not found" to non-owners would leak less, but the spec asks for an
  // explicit permission failure so agents can tell the two apart.
  if (!canRead(row, actor)) {
    throw new LectaError(actor.userId ? "FORBIDDEN" : "UNAUTHORIZED", "This exhibition is a private draft. Only its owner can read it.");
  }
  return load(db, row, actor);
}

export function listFeatured(actor: Actor, db: DatabaseSync = getDb()): ExhibitionView[] {
  const rows = db.prepare("SELECT * FROM exhibitions WHERE visibility = 'PUBLIC' ORDER BY number").all() as Row[];
  return rows.map((r) => load(db, r, actor));
}

export function listMine(actor: Actor, db: DatabaseSync = getDb()): ExhibitionView[] {
  if (!actor.userId) return [];
  const rows = db.prepare("SELECT * FROM exhibitions WHERE owner_id = ? ORDER BY created_at DESC, id").all(actor.userId) as Row[];
  return rows.map((r) => load(db, r, actor));
}

function requireWriter(actor: Actor): string {
  if (!actor.userId) throw new LectaError("UNAUTHORIZED", "Writing requires the demo workspace (DEMO_MODE=true) or a valid agent key.");
  return actor.userId;
}

function assertWorksExist(db: DatabaseSync, ids: string[]) {
  const found = new Set(getWorksByIds(ids, db).map((w) => w.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new LectaError("WORK_NOT_FOUND", `Unknown work id(s): ${missing.join(", ")}`, false, { missing });
}

function recordCurationSignals(db: DatabaseSync, userId: string, exhibitionId: string, notes: { workId: string; note: string | null }[], origin: string) {
  const ins = db.prepare(
    "INSERT INTO taste_signals (id, user_id, work_id, exhibition_id, signal_type, why_text, structured_tags_json, origin, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
  );
  for (const n of notes) {
    const tags = n.note ? extractTagsFromText(n.note).map((m) => m.key) : [];
    ins.run(newId("sig"), userId, n.workId, exhibitionId, "CURATED", n.note, tags.length ? JSON.stringify(tags) : null, origin, nowIso());
  }
}

export interface CreateResult {
  exhibition: ExhibitionView;
  created: boolean; // false when an identical requestId was replayed
}

export function createExhibition(
  input: unknown,
  actor: Actor,
  opts: { origin?: "USER_EXPLICIT" | "MODEL_SUGGESTED" } = {},
  db: DatabaseSync = getDb(),
): CreateResult {
  const parsed = createExhibitionSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const data: CreateExhibitionInput = parsed.data;
  const userId = requireWriter(actor);

  if (new Set(data.workIds).size !== data.workIds.length) throw new LectaError("VALIDATION_ERROR", "workIds contains duplicates");
  const noteWork = (data.curatorNotes ?? []).find((n) => !data.workIds.includes(n.workId));
  if (noteWork) throw new LectaError("VALIDATION_ERROR", `curatorNotes refers to ${noteWork.workId}, which is not in workIds`);

  if (data.requestId) {
    const prior = db.prepare("SELECT * FROM exhibitions WHERE owner_id = ? AND request_key = ?").get(userId, data.requestId) as Row | undefined;
    if (prior) return { exhibition: load(db, prior, actor), created: false };
  }
  assertWorksExist(db, data.workIds);

  const id = newId("ex");
  const notes = new Map((data.curatorNotes ?? []).map((n) => [n.workId, n.note || null]));
  tx(db, () => {
    const max = db.prepare("SELECT COALESCE(MAX(number), 0) AS n FROM exhibitions").get() as Row;
    const now = nowIso();
    db.prepare(
      "INSERT INTO exhibitions (id, owner_id, title, description, visibility, layout_template, is_editorial, number, request_key, version, created_at, updated_at) VALUES (?,?,?,?, 'DRAFT', 'EDITORIAL_01', 0, ?, ?, 1, ?, ?)",
    ).run(id, userId, data.title, data.description || null, (max.n as number) + 1, data.requestId ?? null, now, now);
    const ins = db.prepare("INSERT INTO exhibition_items (id, exhibition_id, work_id, position, curator_note) VALUES (?,?,?,?,?)");
    data.workIds.forEach((w, i) => ins.run(newId("exi"), id, w, i, notes.get(w) ?? null));
    recordCurationSignals(db, userId, id, data.workIds.map((w) => ({ workId: w, note: notes.get(w) ?? null })), opts.origin ?? "USER_EXPLICIT");
  });
  return { exhibition: getExhibition(id, actor, db), created: true };
}

export function updateExhibition(id: string, input: unknown, actor: Actor, db: DatabaseSync = getDb()): ExhibitionView {
  const parsed = patchExhibitionSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const userId = requireWriter(actor);
  const row = rowOrThrow(db, id);
  if (row.owner_id !== userId) throw new LectaError("FORBIDDEN", "Only the owner can edit this exhibition.");
  const p = parsed.data;
  if (p.expectedVersion && p.expectedVersion !== row.version) {
    throw new LectaError("CONFLICT", "This exhibition changed since you opened it. Reload and try again.", false, { currentVersion: row.version });
  }
  if (p.items) {
    const ids = p.items.map((i) => i.workId);
    if (new Set(ids).size !== ids.length) throw new LectaError("VALIDATION_ERROR", "items contains duplicate works");
    assertWorksExist(db, ids);
  }
  tx(db, () => {
    db.prepare("UPDATE exhibitions SET title = ?, description = ?, version = version + 1, updated_at = ? WHERE id = ?").run(
      p.title ?? (row.title as string),
      p.description !== undefined ? p.description || null : ((row.description as string) ?? null),
      nowIso(),
      id,
    );
    if (p.items) {
      db.prepare("DELETE FROM exhibition_items WHERE exhibition_id = ?").run(id);
      const ins = db.prepare("INSERT INTO exhibition_items (id, exhibition_id, work_id, position, curator_note) VALUES (?,?,?,?,?)");
      p.items.forEach((it, i) => ins.run(newId("exi"), id, it.workId, i, it.curatorNote || null));
    }
  });
  return getExhibition(id, actor, db);
}

export function addItem(id: string, input: unknown, actor: Actor, db: DatabaseSync = getDb()): ExhibitionView {
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const userId = requireWriter(actor);
  const row = rowOrThrow(db, id);
  if (row.owner_id !== userId) throw new LectaError("FORBIDDEN", "Only the owner can add works to this exhibition.");
  const { workId, curatorNote, fromRecommendation, score } = parsed.data;
  assertWorksExist(db, [workId]);
  const dup = db.prepare("SELECT 1 FROM exhibition_items WHERE exhibition_id = ? AND work_id = ?").get(id, workId);
  if (dup) throw new LectaError("CONFLICT", "This work is already in the exhibition.");
  const count = (db.prepare("SELECT COUNT(*) AS n FROM exhibition_items WHERE exhibition_id = ?").get(id) as Row).n as number;
  if (count >= 16) throw new LectaError("VALIDATION_ERROR", "An exhibition can hold at most 16 works.");
  tx(db, () => {
    const max = db.prepare("SELECT COALESCE(MAX(position), -1) AS p FROM exhibition_items WHERE exhibition_id = ?").get(id) as Row;
    db.prepare("INSERT INTO exhibition_items (id, exhibition_id, work_id, position, curator_note) VALUES (?,?,?,?,?)").run(
      newId("exi"), id, workId, (max.p as number) + 1, curatorNote || null,
    );
    db.prepare("UPDATE exhibitions SET version = version + 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
    if (fromRecommendation) {
      const seeds = db.prepare("SELECT work_id FROM exhibition_items WHERE exhibition_id = ? AND work_id != ? ORDER BY position").all(id, workId) as Row[];
      db.prepare(
        "INSERT INTO recommendation_events (id, user_id, exhibition_id, seed_work_ids_json, candidate_work_id, score, score_breakdown_json, model_version, action, created_at) VALUES (?,?,?,?,?,?,?,?, 'ADDED', ?)",
      ).run(newId("rev"), userId, id, JSON.stringify(seeds.map((s) => s.work_id)), workId, score ?? 0, "{}", "coldstart-v1", nowIso());
      db.prepare(
        "INSERT INTO taste_signals (id, user_id, work_id, exhibition_id, signal_type, why_text, structured_tags_json, origin, created_at) VALUES (?,?,?,?, 'RECOMMENDATION_ADDED', NULL, NULL, 'USER_EXPLICIT', ?)",
      ).run(newId("sig"), userId, workId, id, nowIso());
    }
  });
  return getExhibition(id, actor, db);
}
