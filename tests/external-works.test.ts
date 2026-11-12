import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { freshDb, code, anon, demo, stranger } from "./helpers";
import type { Db } from "../src/lib/db";
import { works } from "../src/lib/schema";
import { searchExternal } from "../src/lib/external/registry";
import { createKopis, workTitleOf } from "../src/lib/external/kopis";
import { createSeoulCulture } from "../src/lib/external/seoul-culture";
import { createTmdb } from "../src/lib/external/tmdb";
import { createMusicBrainz } from "../src/lib/external/musicbrainz";
import { stamp, type ExternalMedium, type ExternalProvider, type ExternalSource, type ExternalWork } from "../src/lib/external/types";
import { importExternalWorks, refreshExpiredWorks, saveExternalWork, withoutSaved } from "../src/lib/services/external-works";
import { createExhibition } from "../src/lib/services/exhibitions";
import { searchWorks } from "../src/lib/services/works";
import { LectaError } from "../src/lib/services/errors";

const NOW = new Date("2026-11-12T00:00:00.000Z");

function work(source: ExternalSource, externalId: string, medium: ExternalMedium, over: Partial<ExternalWork> = {}): ExternalWork {
  return {
    ...stamp(source, NOW), externalId, medium, title: `title ${externalId}`, originalTitle: null, creator: "someone", releaseYear: 2020,
    synopsis: "synopsis", artwork: { url: "https://img.example/a.jpg", credit: source, sourcePage: null }, sourceUrl: "https://src.example/a", ...over,
  };
}

/** A provider that answers from a list and counts its lookups. */
function fake(source: ExternalSource, media: ExternalMedium[], items: ExternalWork[] | Error) {
  const p = {
    source, media, lookups: 0,
    async search() { if (items instanceof Error) throw items; return items; },
    async lookup(id: string) { p.lookups++; if (items instanceof Error) throw items; return items.find((w) => w.externalId === id) ?? null; },
  };
  return p satisfies ExternalProvider;
}

describe("searching every external catalog", () => {
  it("asks only the providers that cover the medium and keeps going when one fails", async () => {
    const tmdb = fake("TMDB", ["FILM", "SERIES"], [work("TMDB", "movie:1", "FILM")]);
    const kakao = fake("KAKAO_BOOK", ["BOOK"], [work("KAKAO_BOOK", "9780000000001", "BOOK")]);
    const kopis = fake("KOPIS", ["PERFORMANCE"], new LectaError("SERVICE_UNAVAILABLE", "KOPIS is not configured", false));

    const all = await searchExternal({ q: "x" }, [tmdb, kakao, kopis]);
    expect(all.works.map((w) => w.source)).toEqual(["TMDB", "KAKAO_BOOK"]);
    expect(all.failedSources).toEqual([{ source: "KOPIS", code: "SERVICE_UNAVAILABLE", message: "KOPIS is not configured" }]);

    const books = await searchExternal({ q: "x", medium: "BOOK" }, [tmdb, kakao, kopis]);
    expect(books.works.map((w) => w.source)).toEqual(["KAKAO_BOOK"]);
    expect(books.failedSources).toEqual([]);
  });
});

describe("saving an external work", () => {
  let db: Db;
  beforeEach(async () => { db = await freshDb(); });

  it("stores what the source says, with its licence, expiry and attribution", async () => {
    const tmdb = fake("TMDB", ["FILM"], [work("TMDB", "movie:496243", "FILM", { title: "기생충", creator: "봉준호", releaseYear: 2019 })]);
    const { work: saved, created } = await saveExternalWork({ source: "TMDB", externalId: "movie:496243", medium: "FILM" }, demo, { db, providers: [tmdb] });

    expect(created).toBe(true);
    expect(saved).toMatchObject({
      medium: "FILM", title: "기생충", creator: "봉준호", releaseYear: 2019, metadataStatus: "VERIFIED", tags: [], event: null,
      artwork: { url: "https://img.example/a.jpg", credit: "TMDB" },
      source: { name: "TMDB", attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB." },
    });
    const [row] = await db.select().from(works).where(eq(works.id, saved.id));
    expect(row).toMatchObject({ externalSource: "TMDB", externalId: "movie:496243", license: "TMDB API Terms of Use (non-commercial)" });
    expect(row.metadataExpiresAt?.toISOString()).toBe("2027-02-10T00:00:00.000Z");
    // it is now part of the catalog: searchable, and it can hang in a room
    expect((await searchWorks({ q: "기생충" }, db)).works.map((w) => w.id)).toContain(saved.id);
    expect(await code(createExhibition({ title: "room", workIds: [saved.id, "w_film_aftersun"] }, demo))).toBe("NO_ERROR");
  });

  it("keeps one row per external work however many people save it", async () => {
    const mb = fake("MUSICBRAINZ", ["ALBUM"], [work("MUSICBRAINZ", "9ad6d1a2-7495-4d0c-9aad-de058bfb1493", "ALBUM")]);
    const input = { source: "MUSICBRAINZ", externalId: "9ad6d1a2-7495-4d0c-9aad-de058bfb1493", medium: "ALBUM" };
    const first = await saveExternalWork(input, demo, { db, providers: [mb] });
    const second = await saveExternalWork(input, stranger, { db, providers: [mb] });
    const [a, b] = await Promise.all([{ ...input, externalId: "x" }, { ...input, externalId: "x" }].map(() => saveExternalWork(input, demo, { db, providers: [mb] })));

    expect([second.created, second.work.id]).toEqual([false, first.work.id]);
    expect(new Set([a.work.id, b.work.id, first.work.id]).size).toBe(1);
    expect((await db.select().from(works).where(eq(works.externalSource, "MUSICBRAINZ")))).toHaveLength(1);
    expect(first.work.source.name).toBe("MUSICBRAINZ");
  });

  it("leaves works we already have out of the external results", async () => {
    // TMDB and KOPIS ids can collide as plain strings, so the source has to match too
    const film = work("TMDB", "movie:1", "FILM");
    const other = work("TMDB", "movie:2", "FILM");
    const sameIdElsewhere = work("KOPIS", "movie:1", "PERFORMANCE");
    await saveExternalWork({ source: "TMDB", externalId: "movie:1", medium: "FILM" }, demo, { db, providers: [fake("TMDB", ["FILM"], [film])] });

    expect((await withoutSaved([film, other, sameIdElsewhere], db)).map((w) => `${w.source}:${w.externalId}`)).toEqual(["TMDB:movie:2", "KOPIS:movie:1"]);
    expect(await withoutSaved([], db)).toEqual([]);
  });

  it("stores a performance with its venue and dates, and keeps permanent sources without an expiry", async () => {
    const event = { venue: "블루스퀘어", startDate: "2023-11-30", endDate: "2024-03-10", genre: "뮤지컬", workTitle: "레미제라블" };
    const kopis = fake("KOPIS", ["PERFORMANCE"], [work("KOPIS", "PF132236", "PERFORMANCE", { event })]);
    const { work: saved } = await saveExternalWork({ source: "KOPIS", externalId: "PF132236", medium: "PERFORMANCE" }, demo, { db, providers: [kopis] });

    expect(saved).toMatchObject({ medium: "PERFORMANCE", event });
    const [row] = await db.select().from(works).where(eq(works.id, saved.id));
    expect(row.metadataExpiresAt).toBeNull();
  });

  it("lists the whole catalog, new media included, when nothing is filtered", async () => {
    // an unfiltered listing interleaves the media; it used to loop forever once a performance was in the catalog
    const kopis = fake("KOPIS", ["PERFORMANCE"], [work("KOPIS", "PF132236", "PERFORMANCE")]);
    const seoul = fake("SEOUL_CULTURE", ["EXHIBITION"], [work("SEOUL_CULTURE", "160148", "EXHIBITION")]);
    const mb = fake("MUSICBRAINZ", ["TRACK"], [work("MUSICBRAINZ", "cf3b2fd9-e6cc-49bf-abf3-63a3af75a6dc", "TRACK")]);
    const providers = [kopis, seoul, mb];
    const before = (await searchWorks({ limit: 60 }, db)).total;
    for (const p of providers) await saveExternalWork({ source: p.source, externalId: (await p.search())[0].externalId, medium: p.media[0] }, demo, { db, providers });

    const { works: listed, total } = await searchWorks({ limit: 60 }, db);
    expect(total).toBe(before + 3);
    expect(listed).toHaveLength(60);
    expect(listed.slice(0, 7).map((w) => w.medium)).toEqual(["FILM", "BOOK", "ALBUM", "SERIES", "TRACK", "PERFORMANCE", "EXHIBITION"]);
    expect((await searchWorks({ medium: "PERFORMANCE" }, db)).total).toBe(1);
  });

  it("refuses anonymous callers, bad input and ids the source does not have, without calling the source needlessly", async () => {
    const tmdb = fake("TMDB", ["FILM"], []);
    const deps = { db, providers: [tmdb] };
    expect(await code(saveExternalWork({ source: "TMDB", externalId: "movie:1", medium: "FILM" }, anon, deps))).toBe("UNAUTHORIZED");
    expect(await code(saveExternalWork({ source: "IMDB", externalId: "tt1", medium: "FILM" }, demo, deps))).toBe("VALIDATION_ERROR");
    expect(await code(saveExternalWork({ source: "TMDB", externalId: "", medium: "FILM" }, demo, deps))).toBe("VALIDATION_ERROR");
    expect(tmdb.lookups).toBe(0);
    expect(await code(saveExternalWork({ source: "TMDB", externalId: "movie:1", medium: "FILM" }, demo, deps))).toBe("WORK_NOT_FOUND");
    expect(await code(saveExternalWork({ source: "KOPIS", externalId: "PF1", medium: "PERFORMANCE" }, demo, deps))).toBe("VALIDATION_ERROR");
  });

  it("refetches only the works whose cached metadata has expired", async () => {
    const book = work("KAKAO_BOOK", "9788936434120", "BOOK", { title: "소년이 온다", synopsis: "old" });
    const kakao = fake("KAKAO_BOOK", ["BOOK"], [book]);
    const mb = fake("MUSICBRAINZ", ["ALBUM"], [work("MUSICBRAINZ", "11111111-2222-3333-4444-555555555555", "ALBUM")]);
    const providers = [kakao, mb];
    const saved = await saveExternalWork({ source: "KAKAO_BOOK", externalId: book.externalId, medium: "BOOK" }, demo, { db, providers });
    await saveExternalWork({ source: "MUSICBRAINZ", externalId: "11111111-2222-3333-4444-555555555555", medium: "ALBUM" }, demo, { db, providers });
    const before = { kakao: kakao.lookups, mb: mb.lookups };

    // Kakao metadata lives one day
    expect(await refreshExpiredWorks({ db, providers, now: () => new Date("2026-11-12T12:00:00.000Z") })).toEqual({ refreshed: 0, failed: 0 });
    book.synopsis = "new";
    Object.assign(book, stamp("KAKAO_BOOK", new Date("2026-11-14T00:00:00.000Z")));
    expect(await refreshExpiredWorks({ db, providers, now: () => new Date("2026-11-14T00:00:00.000Z") })).toEqual({ refreshed: 1, failed: 0 });

    const [row] = await db.select().from(works).where(eq(works.id, saved.work.id));
    expect(row.synopsis).toBe("new");
    expect(row.metadataExpiresAt?.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect([kakao.lookups - before.kakao, mb.lookups - before.mb]).toEqual([1, 0]);
  });

  it("counts a work the source no longer answers for as failed and leaves it as it was", async () => {
    const items = [work("KAKAO_BOOK", "9788936434120", "BOOK", { title: "kept" })];
    const kakao = fake("KAKAO_BOOK", ["BOOK"], items);
    const saved = await saveExternalWork({ source: "KAKAO_BOOK", externalId: "9788936434120", medium: "BOOK" }, demo, { db, providers: [kakao] });
    items.length = 0;
    expect(await refreshExpiredWorks({ db, providers: [kakao], now: () => new Date("2026-12-01T00:00:00.000Z") })).toEqual({ refreshed: 0, failed: 1 });
    const [row] = await db.select().from(works).where(eq(works.id, saved.work.id));
    expect(row.title).toBe("kept");
  });
});

describe("seeding the catalog with well-known works", () => {
  it("imports a batch once, and only refreshes it when run again", async () => {
    const db = await freshDb();
    const batch = [work("TMDB", "movie:1", "FILM"), work("MUSICBRAINZ", "11111111-2222-3333-4444-555555555555", "ALBUM"), work("SEOUL_CULTURE", "160148", "EXHIBITION")];
    expect(await importExternalWorks(batch, db)).toEqual({ created: 3, updated: 0 });
    batch[0] = { ...batch[0], title: "renamed" };
    expect(await importExternalWorks(batch, db)).toEqual({ created: 0, updated: 3 });
    expect((await db.select().from(works).where(eq(works.externalId, "movie:1"))).map((r) => r.title)).toEqual(["renamed"]);
  });

  it("TMDB lists the most-voted films page by page and adds each director", async () => {
    const urls: string[] = [];
    const fetch = (async (url: string) => {
      urls.push(url);
      const u = new URL(url);
      if (u.pathname.endsWith("/discover/movie")) {
        const page = Number(u.searchParams.get("page"));
        return new Response(JSON.stringify({ results: Array.from({ length: 20 }, (_, i) => ({ id: page * 100 + i, title: `film ${page * 100 + i}`, release_date: "2010-01-01" })) }));
      }
      const id = Number(u.pathname.split("/").pop());
      if (id === 101) return new Response("{}", { status: 500 }); // one detail call fails: the listed film is kept
      return new Response(JSON.stringify({ id, title: `film ${id}`, release_date: "2010-01-01", credits: { crew: [{ job: "Director", name: `director ${id}` }] } }));
    }) as typeof globalThis.fetch;
    const found = await createTmdb({ fetch, env: { TMDB_API_KEY: "k" } }).popular!(30);

    expect(found).toHaveLength(30);
    expect(found.map((w) => w.externalId).slice(0, 3)).toEqual(["movie:100", "movie:101", "movie:102"]);
    expect([found[0].creator, found[1].creator, found[29].creator]).toEqual(["director 100", "", "director 209"]);
    const lists = urls.filter((u) => u.includes("/discover/movie"));
    expect(lists).toHaveLength(2);
    expect(lists[0]).toContain("sort_by=vote_count.desc");
  });

  it("MusicBrainz takes the most-listened albums from ListenBrainz and their years in batches", async () => {
    const top = Array.from({ length: 30 }, (_, i) => ({ release_group_mbid: `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`, release_group_name: `album ${i}`, artist_name: `artist ${i}` }));
    const calls: string[] = [];
    const fetch = (async (url: string) => {
      calls.push(url);
      if (url.includes("listenbrainz")) return new Response(JSON.stringify({ payload: { release_groups: [...top, { release_group_name: "no id" }] } }));
      if (calls.filter((c) => c.includes("musicbrainz.org")).length === 2) return new Response("{}", { status: 500 }); // second batch fails: no years for it
      return new Response(JSON.stringify({ "release-groups": top.slice(0, 25).map((g) => ({ id: g.release_group_mbid, title: g.release_group_name, "first-release-date": "1997-05-21" })) }));
    }) as typeof globalThis.fetch;
    const found = await createMusicBrainz({ fetch, sleep: async () => {}, userAgent: "t" }).popular!(31);

    expect(found).toHaveLength(30);
    expect(found[0]).toMatchObject({ medium: "ALBUM", title: "album 0", creator: "artist 0", releaseYear: 1997, expiresAt: null });
    expect(found[29]).toMatchObject({ title: "album 29", releaseYear: null });
    expect(calls[0]).toContain("count=31");
    expect(calls.filter((c) => c.includes("musicbrainz.org"))).toHaveLength(2);
    expect(decodeURIComponent(calls[1])).toContain("rgid:(00000000-0000-0000-0000-000000000000 OR ");
  });

  it("Seoul lists exhibitions a thousand rows at a time", async () => {
    const urls: string[] = [];
    const row = (n: number, CODENAME = "전시/미술") => ({ CODENAME, TITLE: `전시 ${n}`, STRTDATE: "2026-11-10 00:00:00.0", END_DATE: "2026-12-10 00:00:00.0", HMPG_ADDR: `https://culture.seoul.go.kr/view.do?cultcode=${n}&menuNo=1` });
    const fetch = (async (url: string) => {
      urls.push(url);
      const from = Number(url.split("/culturalEventInfo/")[1].split("/")[0]);
      const rows = from === 1 ? [row(1), row(2), row(3, "전시/관람")] : from === 1001 ? [row(4)] : [];
      return new Response(JSON.stringify(rows.length ? { culturalEventInfo: { RESULT: { CODE: "INFO-000", MESSAGE: "ok" }, row: rows } } : { RESULT: { CODE: "INFO-200", MESSAGE: "none" } }));
    }) as typeof globalThis.fetch;
    const found = await createSeoulCulture({ fetch, env: { SEOUL_OPENDATA_API_KEY: "sk" } }).popular!(10);

    expect(found.map((w) => w.externalId)).toEqual(["1", "2", "4"]);
    expect(urls.map((u) => u.split("/culturalEventInfo/")[1])).toEqual([`1/1000/${encodeURIComponent("전시")}`, `1001/2000/${encodeURIComponent("전시")}`, `2001/3000/${encodeURIComponent("전시")}`]);
  });
});

describe("KOPIS runs of one work", () => {
  it("reads the work's title out of a run's title", () => {
    expect(workTitleOf("레미제라블 [구미]")).toBe("레미제라블");
    expect(workTitleOf("레미제라블 [청주]")).toBe("레미제라블");
    expect(workTitleOf("[대학로] 옥탑방 고양이 (앙코르)")).toBe("옥탑방 고양이");
    expect(workTitleOf("2026 시카고 앵콜")).toBe("시카고");
    // a different work that happens to share a word stays apart
    expect(workTitleOf("레미제라블: 코제트 소녀이야기 [횡성]")).toBe("레미제라블: 코제트 소녀이야기");
    expect(workTitleOf("1984")).toBe("1984");
    expect(workTitleOf("[서울]")).toBe("[서울]");
  });

  it("walks the pages when more than one page of runs is wanted", async () => {
    const pages: string[] = [];
    const run = (n: number) => `<db><mt20id>PF${n}</mt20id><prfnm>공연 ${n} [서울]</prfnm><prfpdfrom>2026.01.01</prfpdfrom><prfpdto>2026.01.02</prfpdto></db>`;
    const fetch = (async (url: string) => {
      const page = Number(new URL(url).searchParams.get("cpage"));
      pages.push(`${page}/${new URL(url).searchParams.get("rows")}`);
      const count = page === 1 ? 100 : 30; // the second page is the last
      return new Response(`<dbs>${Array.from({ length: count }, (_, i) => run(page * 1000 + i)).join("")}</dbs>`);
    }) as typeof globalThis.fetch;
    const kopis = createKopis({ fetch, env: { KOPIS_API_KEY: "kk" } });

    const found = await kopis.search({ q: "공연", limit: 250 });
    expect(found).toHaveLength(130);
    expect(pages).toEqual(["1/100", "2/100"]);
    expect(found[0].event?.workTitle).toBe("공연 1000");

    pages.length = 0;
    expect(await kopis.search({ q: "공연", limit: 10 })).toHaveLength(10);
    expect(pages).toEqual(["1/10"]);
  });
});

describe("Seoul events cannot be looked up by id", () => {
  it("finds the event again by its title and matches on the id", async () => {
    const row = (cultcode: string, TITLE: string) => ({
      CODENAME: "전시/미술", TITLE, PLACE: "운현궁", ORG_NAME: "운현궁", STRTDATE: "2026-11-10 00:00:00.0", END_DATE: "2026-12-10 00:00:00.0",
      HMPG_ADDR: `https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=${cultcode}&menuNo=200009`,
    });
    const urls: string[] = [];
    const fetch = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ culturalEventInfo: { RESULT: { CODE: "INFO-000", MESSAGE: "ok" }, row: [row("1", "궁 다른 전시"), row("160148", "궁, 시간을 수 놓다")] } }));
    }) as typeof globalThis.fetch;
    const seoul = createSeoulCulture({ fetch, env: { SEOUL_OPENDATA_API_KEY: "sk" } });

    expect(await seoul.lookup("160148", "EXHIBITION", { title: "궁, 시간을 수 놓다" })).toMatchObject({ externalId: "160148", title: "궁, 시간을 수 놓다" });
    expect(await seoul.lookup("999", "EXHIBITION", { title: "궁, 시간을 수 놓다" })).toBeNull();
    expect(urls).toHaveLength(2);
    expect(await seoul.lookup("160148", "EXHIBITION")).toBeNull();
    expect(urls).toHaveLength(2);
  });
});
