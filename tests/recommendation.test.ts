import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { freshDb, anon, demo } from "./helpers";
import { recommend } from "../src/lib/recommendation/engine";
import { createExhibition } from "../src/lib/services/exhibitions";
import { getWorksByIds } from "../src/lib/services/works";
import { LectaError } from "../src/lib/services/errors";

let db: DatabaseSync;
beforeEach(() => {
  db = freshDb();
  delete process.env.ANTHROPIC_API_KEY; // the required path must not depend on a model key
});

const EX = "ex_on_things_left_unsaid";

describe("coldstart-v1 recommendation", () => {
  it("is deterministic for the same input and database", () => {
    const a = recommend({ exhibitionId: EX, limit: 5 }, anon, db, { log: false });
    const b = recommend({ exhibitionId: EX, limit: 5 }, anon, db, { log: false });
    expect(a.recommendations.map((r) => r.workId)).toEqual(b.recommendations.map((r) => r.workId));
    expect(a.recommendations.map((r) => r.score)).toEqual(b.recommendations.map((r) => r.score));
    expect(a.algorithmVersion).toBe("coldstart-v1");
  });

  it("never returns seed works or explicitly excluded works", () => {
    const seeds = ["w_film_mood_for_love", "w_book_remains_of_day", "w_album_blue", "w_film_drive_my_car"];
    const excluded = ["w_book_never_let_me_go"];
    const r = recommend({ exhibitionId: EX, limit: 10, excludedWorkIds: excluded }, anon, db, { log: false });
    const ids = r.recommendations.map((x) => x.workId);
    for (const s of [...seeds, ...excluded]) expect(ids).not.toContain(s);
    expect(r.excludedSeedIds).toEqual(expect.arrayContaining(seeds));
  });

  it("drops adaptations of a seed (same title in another medium)", () => {
    const r = recommend({ seedWorkIds: ["w_book_pachinko", "w_film_past_lives"], limit: 10 }, anon, db, { log: false });
    expect(r.recommendations.map((x) => x.workId)).not.toContain("w_series_pachinko");
  });

  it("respects targetMedium", () => {
    const r = recommend({ exhibitionId: EX, targetMedium: "BOOK", limit: 5 }, anon, db, { log: false });
    expect(r.recommendations.length).toBe(5);
    expect(r.recommendations.every((x) => x.medium === "BOOK")).toBe(true);
  });

  it("changes in an explainable way when the 'why I liked it' reason changes", () => {
    const base = { exhibitionId: EX, targetMedium: "ALBUM" as const, limit: 3 };
    const sonic = recommend({ ...base, likedReasons: ["sonic texture"] }, anon, db, { log: false });
    const solo = recommend({ ...base, likedReasons: ["solitude"] }, anon, db, { log: false });
    expect(sonic.appliedReasons.map((x) => x.key)).toEqual(["sonic_texture"]);
    expect(solo.appliedReasons.map((x) => x.key)).toEqual(["solitude"]);
    // the why-score of the top pick reflects the stated reason
    expect(sonic.recommendations[0].scoreBreakdown.why).toBeGreaterThan(0);
    expect(sonic.recommendations[0].reasons.some((r) => r.type === "why_match" && r.tag === "sonic_texture")).toBe(true);
    expect(sonic.recommendations.map((x) => x.workId)).not.toEqual(solo.recommendations.map((x) => x.workId));
  });

  it("grounds every tag reason in real WorkTag rows of the candidate and the evidence seed", () => {
    const r = recommend({ exhibitionId: EX, limit: 5 }, anon, db, { log: false });
    for (const rec of r.recommendations) {
      const [cand] = getWorksByIds([rec.workId], db);
      for (const reason of rec.reasons.filter((x) => x.type === "shared_theme")) {
        expect(cand.tagKeys).toContain(reason.tag);
        const [seed] = getWorksByIds([reason.evidenceWorkId!], db);
        expect(seed.tagKeys).toContain(reason.tag);
      }
      expect(rec.reasons.length).toBeGreaterThanOrEqual(2);
      for (const v of Object.values(rec.scoreBreakdown)) if (v !== null) expect(v).toBeGreaterThanOrEqual(0);
      expect(rec.score).toBeLessThanOrEqual(1);
    }
  });

  it("works for a brand-new user exhibition (no behavioural data)", () => {
    const { exhibition } = createExhibition(
      { title: "Longing & Other Quiet Things", workIds: ["w_film_aftersun", "w_book_stoner", "w_album_pink_moon"] },
      demo, {}, db,
    );
    const r = recommend({ exhibitionId: exhibition.id, limit: 3 }, demo, db);
    expect(r.recommendations).toHaveLength(3);
    const logged = db.prepare("SELECT COUNT(*) AS n FROM recommendation_events WHERE exhibition_id = ? AND action = 'EXPOSED'").get(exhibition.id) as { n: number };
    expect(logged.n).toBe(3);
  });

  it("fails explicitly for unknown ids and private drafts", () => {
    expect(() => recommend({ seedWorkIds: ["w_does_not_exist"] }, anon, db)).toThrowError(LectaError);
    try { recommend({ exhibitionId: "ex_missing_123" }, anon, db); } catch (e) { expect((e as LectaError).code).toBe("EXHIBITION_NOT_FOUND"); }
    const { exhibition } = createExhibition({ title: "Mine", workIds: ["w_film_aftersun", "w_book_stoner"] }, demo, {}, db);
    try { recommend({ exhibitionId: exhibition.id }, anon, db); expect.unreachable(); } catch (e) { expect((e as LectaError).code).toBe("UNAUTHORIZED"); }
  });
});
