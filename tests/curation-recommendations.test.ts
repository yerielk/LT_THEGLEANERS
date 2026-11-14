import { beforeEach, describe, expect, it } from "vitest";
import { freshDb, anon, demo } from "./helpers";
import type { Db } from "../src/lib/db";
import { createExhibition } from "../src/lib/services/exhibitions";
import { recommendCurations } from "../src/lib/recommendation/curations";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  delete process.env.LECTA_EMBEDDING_URL;
  delete process.env.LECTA_EMBEDDING_MODEL;
});

describe("curation recommendations", () => {
  it("puts a curation containing the selected work first", async () => {
    const result = await recommendCurations({ q: "memory", workIds: ["w_film_aftersun"] }, anon, db);
    expect(result.recommendations[0]).toMatchObject({ id: "ex_after_the_last_scene", match: "included_work" });
    expect(new Set(result.recommendations.map((r) => r.id)).size).toBe(result.recommendations.length);
  });

  it("prioritizes curations containing more selected works when their tags fit the query", async () => {
    const result = await recommendCurations({ q: "dreamy", workIds: ["w_film_lost_translation", "w_album_teen_dream"] }, anon, db);
    expect(result.recommendations[0]).toMatchObject({ id: "ex_soft_focus", match: "included_work" });
  });

  it("requires selected-work inclusion and query mood tags even when embeddings are available", async () => {
    process.env.LECTA_EMBEDDING_URL = "http://local-embedding";
    process.env.LECTA_EMBEDDING_MODEL = "test-model";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { input: string[] };
      return new Response(JSON.stringify({ embeddings: request.input.map(() => [1, 0]) }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await recommendCurations({ q: "memory", workIds: ["w_film_aftersun"] }, anon, db);
      expect(result.embeddingAvailable).toBe(true);
      expect(result.recommendations[0]).toMatchObject({ id: "ex_after_the_last_scene", match: "included_work" });
      expect(result.recommendations.every((r) => r.reasons.some((reason) => reason.includes("분위기 태그")))).toBe(true);
      expect(result.recommendations.every((r) => r.match === "included_work")).toBe(true);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("keeps keyword results when embedding fails and drops unrelated low scores", async () => {
    process.env.LECTA_EMBEDDING_URL = "http://local-embedding-failure";
    process.env.LECTA_EMBEDDING_MODEL = "test-model";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;
    try {
      const fallback = await recommendCurations({ q: "memory", workIds: ["w_film_aftersun"] }, anon, db);
      expect(fallback.embeddingAvailable).toBe(false);
      expect(fallback.recommendations.length).toBeGreaterThan(0);
      expect(fallback.recommendations.every((r) => r.match === "included_work")).toBe(true);
    } finally { globalThis.fetch = originalFetch; }

    process.env.LECTA_EMBEDDING_URL = "http://local-embedding-orthogonal";
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { input: string[] };
      return new Response(JSON.stringify({ embeddings: request.input.map((_, i) => i === 0 ? [1, 0] : [0, 1]) }), { status: 200 });
    }) as typeof fetch;
    try {
      const unrelated = await recommendCurations({ q: "zz-no-related-curation", workIds: ["w_film_aftersun"] }, anon, db);
      expect(unrelated.recommendations).toEqual([]);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("falls back to keywords and keeps private exhibitions scoped to their owner", async () => {
    const { exhibition } = await createExhibition({ title: "그리움의 메모", description: "기억에 남은 장면", workIds: ["w_film_aftersun", "w_book_stoner"] }, demo, {}, db);
    const strangerResults = await recommendCurations({ q: "solitude", workIds: ["w_book_stoner"] }, anon, db);
    expect(strangerResults.recommendations.map((r) => r.id)).not.toContain(exhibition.id);
    const ownerResults = await recommendCurations({ q: "solitude", workIds: ["w_book_stoner"] }, demo, db);
    expect(ownerResults.recommendations.find((r) => r.id === exhibition.id)).toMatchObject({ visibility: "DRAFT", match: "included_work" });
    expect(ownerResults.embeddingAvailable).toBe(false);
  });

  it("returns an empty result for empty input without errors", async () => {
    expect((await recommendCurations({}, anon, db)).recommendations).toEqual([]);
    expect((await recommendCurations({ q: "memory" }, anon, db)).recommendations).toEqual([]);
    expect((await recommendCurations({ workIds: ["w_film_aftersun"] }, anon, db)).recommendations).toEqual([]);
  });
});
