import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDb, anon, demo } from "./helpers";
import type { Db } from "../src/lib/db";
import { getLibrary, reactionState, renameShelf, toggleLike, toggleSave, DEFAULT_SHELF_NAME } from "../src/lib/services/library";
import { homePicks, tasteMatch, tasteVector } from "../src/lib/services/home";
import { refreshInferredTags } from "../src/lib/services/inferred-tags";
import { works, workTags } from "../src/lib/schema";
import { getWork, getWorksByIds } from "../src/lib/services/works";
import { listFeatured } from "../src/lib/services/exhibitions";

let db: Db;
beforeEach(async () => { db = await freshDb(); });

describe("likes and shelves", () => {
  it("toggles a like and counts it", async () => {
    const target = { targetType: "WORK", targetId: "w_film_aftersun" };
    expect(await toggleLike(target, demo, db)).toEqual({ liked: true, likes: 1 });
    expect((await reactionState("WORK", "w_film_aftersun", demo, db)).liked).toBe(true);
    expect((await reactionState("WORK", "w_film_aftersun", anon, db))).toMatchObject({ liked: false, likes: 1, canReact: false });
    expect(await toggleLike(target, demo, db)).toEqual({ liked: false, likes: 0 });
  });

  it("saves to a default shelf that can be renamed", async () => {
    const featured = await listFeatured(anon, db);
    const saved = await toggleSave({ targetType: "CURATION", targetId: featured[0].id }, demo, db);
    expect(saved).toMatchObject({ saved: true, shelf: { name: DEFAULT_SHELF_NAME } });
    await toggleSave({ targetType: "WORK", targetId: "w_book_stoner" }, demo, db);
    await renameShelf(saved.shelf.id, { name: "겨울에 볼 것" }, demo, db);
    const library = await getLibrary(demo, db);
    expect(library.shelves).toHaveLength(1);
    expect(library.shelves[0]).toMatchObject({ name: "겨울에 볼 것", isDefault: true });
    expect(library.shelves[0].works.map((w) => w.id)).toEqual(["w_book_stoner"]);
    expect(library.shelves[0].curations.map((c) => c.id)).toEqual([featured[0].id]);
  });

  it("refuses anonymous visitors and unknown targets", async () => {
    await expect(toggleLike({ targetType: "WORK", targetId: "w_film_aftersun" }, anon, db)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(toggleSave({ targetType: "WORK", targetId: "w_nope_nope" }, demo, db)).rejects.toMatchObject({ code: "WORK_NOT_FOUND" });
    await expect(renameShelf("col_missing", { name: "x" }, demo, db)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("taste on the home page", () => {
  it("recommends a curation that matches liked works, and works to go with them", async () => {
    for (const id of ["w_film_aftersun", "w_film_past_lives", "w_book_never_let_me_go"]) await toggleLike({ targetType: "WORK", targetId: id }, demo, db);
    const { pick, works: suggested, personalised } = await homePicks(demo, db, () => 0);
    expect(personalised).toBe(true);
    const taste = tasteVector(await getWorksByIds(["w_film_aftersun", "w_film_past_lives", "w_book_never_let_me_go"], db));
    const best = Math.max(...(await listFeatured(demo, db)).filter((e) => !e.isOwner).map((e) => tasteMatch(e, taste)));
    expect(tasteMatch(pick!, taste)).toBe(best);
    expect(suggested!.length).toBeGreaterThan(0);
    expect(suggested!.map((w) => w.id)).not.toContain("w_film_aftersun");
  });

  it("stays random without taste", async () => {
    const result = await homePicks(anon, db, () => 0.3);
    expect(result.personalised).toBe(false);
    expect(result.works).toBeNull();
  });
});

describe("inferred tags", () => {
  it("gives an untagged work tags from its text and its creator, never over curated tags", async () => {
    await db.insert(works).values({ id: "w_ext_test", medium: "BOOK", title: "A Pale View of Hills", creator: (await getWork("w_book_never_let_me_go", db)).creator,
      synopsis: "A mother remembers her daughter and the grief of a lost home.", metadataStatus: "VERIFIED" });
    expect(await refreshInferredTags(["w_ext_test", "w_book_stoner"], db)).toBe(1);
    const tags = await db.select().from(workTags).where(eq(workTags.workId, "w_ext_test"));
    expect(tags.length).toBeGreaterThan(1);
    expect(tags.every((t) => t.provenance === "EXTERNAL" && !t.reviewed && t.weight < 0.7)).toBe(true);
    expect(tags.map((t) => t.tagKey)).toContain("grief");
    const curated = await db.select().from(workTags).where(eq(workTags.workId, "w_book_stoner"));
    expect(curated.every((t) => t.provenance === "HUMAN_CURATED")).toBe(true);
  });
});
