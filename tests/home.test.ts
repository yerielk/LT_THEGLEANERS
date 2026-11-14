import { describe, it, expect, beforeEach } from "vitest";
import { freshDb, anon } from "./helpers";
import type { Db } from "../src/lib/db";
import { homePicks, POPULAR_LIMIT } from "../src/lib/services/home";
import { listFeatured } from "../src/lib/services/exhibitions";

let db: Db;
beforeEach(async () => { db = await freshDb(); });

/** Seeded random numbers, so the random picks can be checked. */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe("home picks", () => {
  it("recommends one public curation and keeps it out of the popular row", async () => {
    const featured = await listFeatured(anon, db);
    const { pick, popular } = await homePicks(anon, db, seeded(7));
    expect(pick).not.toBeNull();
    expect(featured.map((e) => e.id)).toContain(pick!.id);
    expect(popular.map((e) => e.id)).not.toContain(pick!.id);
    expect(popular.length).toBe(Math.min(POPULAR_LIMIT, featured.length - 1));
    expect(new Set(popular.map((e) => e.id)).size).toBe(popular.length);
    expect(popular.every((e) => e.visibility === "PUBLIC")).toBe(true);
  });

  it("is random: different seeds can give different picks", async () => {
    const picks = new Set<string>();
    for (let s = 0; s < 20; s++) picks.add((await homePicks(anon, db, () => (s + 0.5) / 20)).pick!.id);
    expect(picks.size).toBeGreaterThan(1);
  });
});
