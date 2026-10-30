import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { freshDb, anon, demo, stranger } from "./helpers";
import { searchWorks, getWork } from "../src/lib/services/works";
import { createExhibition, getExhibition, updateExhibition, addItem, listFeatured, listMine } from "../src/lib/services/exhibitions";
import { LectaError } from "../src/lib/services/errors";
import { SEED_WORKS } from "../src/lib/data/catalog";

let db: DatabaseSync;
beforeEach(() => { db = freshDb(); });

const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as LectaError).code; } return "NO_ERROR"; };

describe("catalog", () => {
  it("has at least 6 real works per medium and 30+ overall, each with 3+ tags", () => {
    expect(SEED_WORKS.length).toBeGreaterThanOrEqual(30);
    for (const m of ["FILM", "SERIES", "BOOK", "ALBUM"] as const) {
      expect(searchWorks({ medium: m, limit: 60 }, db).total).toBeGreaterThanOrEqual(6);
    }
    for (const w of searchWorks({ limit: 60 }, db).works) {
      expect(w.tags.length).toBeGreaterThanOrEqual(3);
      expect(w.source.name).toBeTruthy();
    }
  });

  it("searches title, creator and Korean tag labels; empty for nonsense", () => {
    expect(searchWorks({ q: "ishiguro" }, db).works.map((w) => w.id)).toEqual(expect.arrayContaining(["w_book_never_let_me_go", "w_book_remains_of_day"]));
    expect(searchWorks({ q: "기억" }, db).total).toBeGreaterThan(3);
    expect(searchWorks({ q: "memory", medium: "ALBUM" }, db).works.every((w) => w.medium === "ALBUM")).toBe(true);
    expect(searchWorks({ q: "zzqqxx-not-a-work" }, db).total).toBe(0);
    expect(code(() => getWork("w_nope", db))).toBe("WORK_NOT_FOUND");
  });
});

describe("exhibitions", () => {
  const input = {
    title: "Longing & Other Quiet Things",
    description: "Quiet works that linger.",
    workIds: ["w_film_aftersun", "w_book_stoner", "w_album_pink_moon"],
    curatorNotes: [{ workId: "w_film_aftersun", note: "The last dance lingers." }],
  };

  it("creates a private draft that persists with order and notes", () => {
    const { exhibition, created } = createExhibition(input, demo, {}, db);
    expect(created).toBe(true);
    expect(exhibition.visibility).toBe("DRAFT");
    const again = getExhibition(exhibition.id, demo, db);
    expect(again.items.map((i) => i.workId)).toEqual(input.workIds);
    expect(again.items[0].curatorNote).toBe("The last dance lingers.");
    expect(listMine(demo, db).map((e) => e.id)).toContain(exhibition.id);
    expect(listFeatured(anon, db).map((e) => e.id)).not.toContain(exhibition.id);
  });

  it("is idempotent per requestId", () => {
    const a = createExhibition({ ...input, requestId: "req-abc-123" }, demo, {}, db);
    const b = createExhibition({ ...input, requestId: "req-abc-123" }, demo, {}, db);
    expect(b.created).toBe(false);
    expect(b.exhibition.id).toBe(a.exhibition.id);
    expect(listMine(demo, db)).toHaveLength(1);
  });

  it("rejects invalid input with explicit codes", () => {
    expect(code(() => createExhibition({ ...input, title: "  " }, demo, {}, db))).toBe("VALIDATION_ERROR");
    expect(code(() => createExhibition({ ...input, workIds: [] }, demo, {}, db))).toBe("VALIDATION_ERROR");
    expect(code(() => createExhibition({ ...input, workIds: ["w_film_aftersun", "w_film_aftersun"] }, demo, {}, db))).toBe("VALIDATION_ERROR");
    expect(code(() => createExhibition({ ...input, workIds: ["w_film_aftersun", "w_fake_work"] }, demo, {}, db))).toBe("WORK_NOT_FOUND");
    expect(code(() => createExhibition({ ...input, title: "<script>alert(1)</script>" }, demo, {}, db))).toBe("VALIDATION_ERROR");
    expect(code(() => createExhibition(input, anon, {}, db))).toBe("UNAUTHORIZED");
  });

  it("enforces ownership on read and write", () => {
    const { exhibition } = createExhibition(input, demo, {}, db);
    expect(code(() => getExhibition(exhibition.id, anon, db))).toBe("UNAUTHORIZED");
    expect(code(() => getExhibition(exhibition.id, stranger, db))).toBe("FORBIDDEN");
    expect(code(() => addItem(exhibition.id, { workId: "w_book_kitchen" }, stranger, db))).toBe("FORBIDDEN");
    expect(code(() => updateExhibition("ex_on_things_left_unsaid", { title: "hijack" }, demo, db))).toBe("FORBIDDEN");
    expect(getExhibition("ex_on_things_left_unsaid", anon, db).isOwner).toBe(false);
  });

  it("reorders, edits and adds items with conflict detection", () => {
    const { exhibition } = createExhibition(input, demo, {}, db);
    const reordered = updateExhibition(exhibition.id, {
      title: "Longing, revised",
      items: [{ workId: "w_album_pink_moon" }, { workId: "w_film_aftersun", curatorNote: "edited" }, { workId: "w_book_stoner" }],
      expectedVersion: 1,
    }, demo, db);
    expect(reordered.items.map((i) => i.workId)).toEqual(["w_album_pink_moon", "w_film_aftersun", "w_book_stoner"]);
    expect(reordered.version).toBe(2);
    expect(code(() => updateExhibition(exhibition.id, { title: "stale", expectedVersion: 1 }, demo, db))).toBe("CONFLICT");
    const added = addItem(exhibition.id, { workId: "w_book_kitchen", fromRecommendation: true, score: 0.5 }, demo, db);
    expect(added.items.at(-1)?.workId).toBe("w_book_kitchen");
    expect(code(() => addItem(exhibition.id, { workId: "w_book_kitchen" }, demo, db))).toBe("CONFLICT");
    const ev = db.prepare("SELECT COUNT(*) AS n FROM recommendation_events WHERE action = 'ADDED'").get() as { n: number };
    expect(ev.n).toBe(1);
  });
});
