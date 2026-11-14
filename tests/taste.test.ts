import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { freshDb, code, anon, demo, stranger } from "./helpers";
import type { Db } from "../src/lib/db";
import { tasteSignals } from "../src/lib/schema";
import { buildProfile, getTaste, saveTaste } from "../src/lib/services/taste";
import { createExhibition } from "../src/lib/services/exhibitions";
import { getWorksByIds } from "../src/lib/services/works";

let db: Db;
beforeEach(async () => { db = await freshDb(); });

const picks = ["w_film_aftersun", "w_book_stoner", "w_album_pink_moon"];

describe("taste survey", () => {
  it("saves picks as LIKED signals, reads a profile and recommends works outside the picks", async () => {
    const saved = await saveTaste({ workIds: picks }, demo, db);
    expect(saved.workIds).toEqual(picks);
    expect(saved.profile.tags.length).toBeGreaterThan(0);
    expect(saved.profile.tags[0].label).toBeTruthy();
    expect(saved.profile.media.map((m) => m.medium).sort()).toEqual(["ALBUM", "BOOK", "FILM"]);
    expect(saved.recommendations.length).toBe(3);
    for (const r of saved.recommendations) expect(picks).not.toContain(r.workId);

    const rows = await db.select().from(tasteSignals).where(and(eq(tasteSignals.userId, demo.userId!), eq(tasteSignals.signalType, "LIKED")));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.origin === "USER_EXPLICIT" && r.exhibitionId === null)).toBe(true);

    expect((await getTaste(demo, db)).workIds).toEqual(picks);
  });

  it("replaces earlier picks, keeps the pick order, and leaves exhibition signals alone", async () => {
    await createExhibition({ title: "Quiet", workIds: ["w_film_aftersun", "w_book_stoner"], curatorNotes: [{ workId: "w_book_stoner", note: "quiet and lingering" }] }, demo, {}, db);
    await saveTaste({ workIds: picks }, demo, db);
    const again = ["w_album_pink_moon", "w_book_never_let_me_go", "w_book_remains_of_day", "w_film_aftersun"];
    await saveTaste({ workIds: again }, demo, db);
    expect((await getTaste(demo, db)).workIds).toEqual(again);
    const curated = await db.select().from(tasteSignals).where(and(eq(tasteSignals.userId, demo.userId!), eq(tasteSignals.signalType, "CURATED")));
    expect(curated.length).toBeGreaterThan(0);
  });

  it("keeps each user's picks separate", async () => {
    await saveTaste({ workIds: picks }, demo, db);
    expect((await getTaste(stranger, db)).workIds).toEqual([]);
    expect((await getTaste(anon, db)).workIds).toEqual([]);
  });

  it("refuses anonymous users, too few or repeated picks, and unknown works", async () => {
    expect(await code(saveTaste({ workIds: picks }, anon, db))).toBe("UNAUTHORIZED");
    expect(await code(saveTaste({ workIds: picks.slice(0, 2) }, demo, db))).toBe("VALIDATION_ERROR");
    expect(await code(saveTaste({ workIds: [...picks, picks[0]] }, demo, db))).toBe("VALIDATION_ERROR");
    expect(await code(saveTaste({ workIds: Array.from({ length: 17 }, (_, i) => `w_x_${i}`) }, demo, db))).toBe("VALIDATION_ERROR");
    expect(await code(saveTaste({ workIds: [...picks.slice(0, 2), "w_nope"] }, demo, db))).toBe("WORK_NOT_FOUND");
    expect((await getTaste(demo, db)).workIds).toEqual([]);
  });

  it("builds a stable profile ordered by summed tag weight", async () => {
    const works = await getWorksByIds(picks, db);
    const a = buildProfile(works);
    const b = buildProfile([...works].reverse());
    expect(a).toEqual(b);
    expect(a.tags.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < a.tags.length; i++) expect(a.tags[i - 1].weight).toBeGreaterThanOrEqual(a.tags[i].weight);
    expect(buildProfile([])).toEqual({ tags: [], media: [] });
  });
});
