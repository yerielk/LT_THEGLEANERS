import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { freshDb, anon, demo } from "./helpers";
import type { Db } from "../src/lib/db";
import { exhibitions, tasteSignals } from "../src/lib/schema";
import { createExhibition, getExhibition, listVisibleForRecommendations, searchVisibleExhibitions } from "../src/lib/services/exhibitions";
import { getCurationDiscovery } from "../src/lib/services/curation-discovery";
import { saveTaste } from "../src/lib/services/taste";
import { createCuration, curationView } from "../src/lib/services/curation-editor";
import { curationWork } from "../src/lib/curation/view";
import { getWork } from "../src/lib/services/works";
import { seedDatabase } from "../src/lib/data/seed";
import { EDITORIAL_USER } from "../src/lib/data/catalog";

let db: Db;
beforeAll(async () => { db = await freshDb(); });

describe("PR6 integration with onboarding and template editor", () => {
  it("matches work titles, rejects unrelated search, and keeps private results owner-only", async () => {
    expect(await searchVisibleExhibitions("zzqqxx-not-a-room", anon, db)).toEqual([]);
    const matches = await searchVisibleExhibitions("Aftersun", anon, db);
    expect(matches.some((ex) => ex.items.some((item) => item.workId === "w_film_aftersun"))).toBe(true);
    const { exhibition } = await createExhibition({ title: "Private phrase zzyy", workIds: ["w_film_aftersun", "w_book_stoner"] }, demo, {}, db);
    expect((await searchVisibleExhibitions("Private phrase zzyy", demo, db)).map((ex) => ex.id)).toContain(exhibition.id);
    expect((await searchVisibleExhibitions("Private phrase zzyy", anon, db)).map((ex) => ex.id)).not.toContain(exhibition.id);
    // Isolate the subsequent onboarding test from this user's curation signals.
    await db.delete(tasteSignals).where(eq(tasteSignals.exhibitionId, exhibition.id));
  });

  it("uses the real LIKED survey signals for discovery and excludes DISLIKED signals", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const workIds = ["w_film_aftersun", "w_book_stoner", "w_album_pink_moon"];
      const editorial = { userId: EDITORIAL_USER.id, kind: "user" as const, label: "Editorial" };
      const { exhibition } = await createExhibition({ title: "Survey picks test", workIds }, editorial, {}, db);
      await db.update(exhibitions).set({ visibility: "PUBLIC" }).where(eq(exhibitions.id, exhibition.id));
      const before = await getCurationDiscovery(demo, db);
      expect(before.suggestedIds).not.toContain(exhibition.id);
      await saveTaste({ workIds }, demo, db);
      const after = await getCurationDiscovery(demo, db);
      expect(after.suggestedIds).toContain(exhibition.id);
      await db.update(tasteSignals).set({ signalType: "DISLIKED" }).where(eq(tasteSignals.userId, demo.userId!));
      expect((await getCurationDiscovery(demo, db)).suggestedIds).not.toContain(exhibition.id);
    } finally { random.mockRestore(); }
  });

  it("preserves template documents in bulk results and never overwrites user drafts when reseeding", async () => {
    const item = curationWork(await getWork("w_film_aftersun", db));
    item.note = "긴 감상과 템플릿 설정은 그대로 보존합니다.";
    const document = { title: "My private template", template: "afterimage", items: [item] };
    const saved = await createCuration({ document, requestId: "pr6_template_roundtrip" }, demo, db);
    const bulk = (await listVisibleForRecommendations(demo, db)).find((ex) => ex.id === saved.id)!;
    expect(curationView(bulk)).toEqual(curationView(saved));
    expect((await listVisibleForRecommendations(anon, db)).map((ex) => ex.id)).not.toContain(saved.id);
    // The manifest also references deployment-only external work IDs. Sparse local catalogs skip them.
    await seedDatabase(db);
    expect(await getExhibition(saved.id, demo, db)).toEqual(saved);
  });
});
