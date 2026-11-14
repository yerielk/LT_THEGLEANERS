import { describe, it, expect, beforeEach } from "vitest";
import { freshDb, anon, demo } from "./helpers";
import type { Db } from "../src/lib/db";
import { searchCurations } from "../src/lib/services/curations";
import { createExhibition, listFeatured } from "../src/lib/services/exhibitions";

let db: Db;
beforeEach(async () => { db = await freshDb(); });

describe("curation search", () => {
  it("reports the public total and returns the first page in room order", async () => {
    const featured = await listFeatured(anon, db);
    const { curations, total } = await searchCurations({}, anon, db);
    expect(total).toBe(featured.length);
    expect(curations.map((h) => h.curation.id)).toEqual(featured.slice(0, 48).map((e) => e.id));
  });

  it("finds curations by title, by a work they hold and by its creator, and says what matched", async () => {
    const [first] = await listFeatured(anon, db);
    const byTitle = await searchCurations({ q: first.title.split(" ")[0] }, anon, db);
    expect(byTitle.curations[0].curation.id).toBe(first.id);
    expect(byTitle.curations[0].matched).toContain("title");

    const work = first.items[0].work;
    const byWork = await searchCurations({ q: work.title }, anon, db);
    expect(byWork.curations.map((h) => h.curation.id)).toContain(first.id);
    expect(byWork.curations.find((h) => h.curation.id === first.id)!.matched).toContain("work");

    const byCreator = await searchCurations({ q: work.creator.split(" ").pop()! }, anon, db);
    expect(byCreator.curations.map((h) => h.curation.id)).toContain(first.id);
  });

  it("returns nothing for nonsense and never shows private drafts", async () => {
    expect((await searchCurations({ q: "zzqqxx-not-a-room" }, anon, db)).total).toBe(0);
    await createExhibition({ title: "Secret Quiet Room", workIds: ["w_film_aftersun", "w_book_stoner"] }, demo, {}, db);
    expect((await searchCurations({ q: "Secret Quiet Room" }, demo, db)).total).toBe(0);
    expect((await searchCurations({ q: "Secret Quiet Room" }, anon, db)).total).toBe(0);
  });
});
