import { describe, it, expect } from "vitest";
import { createTmdb } from "../src/lib/external/tmdb";
import { createKakaoBook } from "../src/lib/external/kakao-book";
import { createKopis, parseDbs } from "../src/lib/external/kopis";
import { createSeoulCulture } from "../src/lib/external/seoul-culture";
import { externalWorkSchema } from "../src/lib/external/types";

const NOW = new Date("2026-11-12T00:00:00.000Z");
const now = () => NOW;

/** Records every request and answers from `reply`. */
function recorder(reply: (url: string) => Response) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, headers: (init.headers ?? {}) as Record<string, string> });
    return reply(url);
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fits = (w: unknown) => expect(externalWorkSchema.parse(w)).toEqual(w);

describe("TMDB provider", () => {
  const MOVIE = { id: 496243, title: "기생충", original_title: "기생충", overview: "전원 백수인 기택네.", release_date: "2019-05-30", poster_path: "/abc.jpg" };
  const SHOW = { id: 93405, name: "오징어 게임", original_name: "오징어 게임", overview: "", first_air_date: "2021-09-17", poster_path: null };

  it("searches films and series, keeps their ids apart and caches for 90 days", async () => {
    const { calls, fetch } = recorder((url) => json({ results: url.includes("/search/movie") ? [MOVIE] : [SHOW] }));
    const found = await createTmdb({ fetch, now, env: { TMDB_READ_ACCESS_TOKEN: "tok" } }).search({ q: "기생충" });

    found.forEach(fits);
    expect(found[0]).toMatchObject({
      source: "TMDB", externalId: "movie:496243", medium: "FILM", title: "기생충", originalTitle: null, releaseYear: 2019,
      artwork: { url: "https://image.tmdb.org/t/p/w342/abc.jpg" }, expiresAt: "2027-02-10T00:00:00.000Z",
    });
    expect(found[1]).toMatchObject({ externalId: "tv:93405", medium: "SERIES", synopsis: null, artwork: null });
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
    expect(calls[0].url).toContain("language=ko-KR");
    expect(calls[0].url).not.toContain("api_key");
  });

  it("falls back to the v3 key, and says so when neither is set", async () => {
    const { calls, fetch } = recorder(() => json({ results: [] }));
    await createTmdb({ fetch, env: { TMDB_API_KEY: "k3" } }).search({ q: "x", medium: "FILM" });
    expect(calls[0].url).toContain("api_key=k3");
    expect(calls[0].headers.Authorization).toBeUndefined();

    await expect(createTmdb({ fetch, env: {} }).search({ q: "x" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", retryable: false });
  });

  it("fills the director in on lookup and answers null for an unknown id", async () => {
    const hit = recorder(() => json({ ...MOVIE, original_title: "Parasite", credits: { crew: [{ job: "Director", name: "봉준호" }, { job: "Writer", name: "한진원" }] } }));
    const work = await createTmdb({ fetch: hit.fetch, env: { TMDB_API_KEY: "k" } }).lookup("movie:496243", "FILM");
    expect(work).toMatchObject({ creator: "봉준호", originalTitle: "Parasite" });
    expect(hit.calls[0].url).toContain("/movie/496243?append_to_response=credits");

    const miss = recorder(() => json({}, 404));
    expect(await createTmdb({ fetch: miss.fetch, env: { TMDB_API_KEY: "k" } }).lookup("tv:1", "SERIES")).toBeNull();
    expect(await createTmdb({ fetch: miss.fetch, env: { TMDB_API_KEY: "k" } }).lookup("496243", "FILM")).toBeNull();
  });

  it("does not leak the key when TMDB rejects it", async () => {
    const { fetch } = recorder(() => json({}, 401));
    const err = await createTmdb({ fetch, env: { TMDB_API_KEY: "secret-key" } }).search({ q: "x" }).catch((e) => e);
    expect(err.message).toBe("TMDB rejected our key");
  });
});

describe("Kakao book provider", () => {
  const DOC = {
    title: "소년이 온다", contents: "1980년 5월.", url: "https://search.daum.net/search?w=bookpage&bookId=1", isbn: "8936434128 9788936434120",
    datetime: "2014-05-19T00:00:00.000+09:00", authors: ["한강"], thumbnail: "https://search1.kakaocdn.net/thumb/x.jpg",
  };

  it("uses the ISBN-13 as the id and expires after a day", async () => {
    const { calls, fetch } = recorder(() => json({ documents: [DOC, { ...DOC, isbn: "" }, { ...DOC, isbn: "8936434128", thumbnail: "" }] }));
    const found = await createKakaoBook({ fetch, now, env: { KAKAO_REST_API_KEY: "rk" } }).search({ q: "소년이 온다" });

    found.forEach(fits);
    expect(found).toHaveLength(2); // the book without an ISBN is dropped
    expect(found[0]).toMatchObject({
      source: "KAKAO_BOOK", externalId: "9788936434120", medium: "BOOK", creator: "한강", releaseYear: 2014, expiresAt: "2026-11-13T00:00:00.000Z",
    });
    expect(found[1]).toMatchObject({ externalId: "8936434128", artwork: null });
    expect(calls[0].headers.Authorization).toBe("KakaoAK rk");
  });

  it("can reuse the Kakao login client id, and looks a book up by ISBN", async () => {
    const { calls, fetch } = recorder(() => json({ documents: [DOC] }));
    const kakao = createKakaoBook({ fetch, env: { KAKAO_CLIENT_ID: "login-id" } });
    expect(await kakao.lookup("9788936434120", "BOOK")).toMatchObject({ title: "소년이 온다" });
    expect(calls[0].headers.Authorization).toBe("KakaoAK login-id");
    expect(calls[0].url).toContain("target=isbn");
    expect(await kakao.search({ q: "x", medium: "FILM" })).toEqual([]);
  });
});

describe("KOPIS provider", () => {
  const LIST = `<?xml version="1.0" encoding="UTF-8"?><dbs>
    <db><mt20id>PF132236</mt20id><prfnm>레미제라블 [부산]</prfnm><prfpdfrom>2023.10.11</prfpdfrom><prfpdto>2023.11.19</prfpdto>
      <fcltynm>드림씨어터 (드림씨어터)</fcltynm><poster>http://www.kopis.or.kr/upload/pfmPoster/PF_1.gif</poster><area>부산광역시</area>
      <genrenm>뮤지컬</genrenm><openrun>N</openrun><prfstate>공연완료</prfstate></db>
    <db><mt20id>PF000002</mt20id><prfnm><![CDATA[Tom & Jerry <Live>]]></prfnm><prfpdfrom>2026.01.02</prfpdfrom><prfpdto>2026.01.03</prfpdto>
      <fcltynm>A &amp; B홀</fcltynm><poster></poster><genrenm>대중음악</genrenm></db></dbs>`;

  it("reads flat records out of the XML, with entities and CDATA", () => {
    const [a, b] = parseDbs(LIST);
    expect(a).toMatchObject({ mt20id: "PF132236", genrenm: "뮤지컬" });
    expect(b).toMatchObject({ prfnm: "Tom & Jerry <Live>", fcltynm: "A & B홀", poster: "" });
  });

  it("turns a run into a performance with its venue, dates and genre", async () => {
    const { calls, fetch } = recorder(() => new Response(LIST));
    const found = await createKopis({ fetch, now, env: { KOPIS_API_KEY: "kk" } }).search({ q: "레미제라블", limit: 5 });

    found.forEach(fits);
    expect(found[0]).toMatchObject({
      source: "KOPIS", externalId: "PF132236", medium: "PERFORMANCE", title: "레미제라블 [부산]", releaseYear: 2023, expiresAt: null,
      event: { venue: "드림씨어터 (드림씨어터)", startDate: "2023-10-11", endDate: "2023-11-19", genre: "뮤지컬" },
      artwork: { url: "https://www.kopis.or.kr/upload/pfmPoster/PF_1.gif", credit: "KOPIS" },
    });
    expect(found[1].artwork).toBeNull();
    const url = new URL(calls[0].url);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ service: "kk", stdate: "20161114", eddate: "20270210", rows: "5", shprfnm: "레미제라블" });
  });

  it("surfaces an error KOPIS reports inside a 200 answer", async () => {
    const { fetch } = recorder(() => new Response("<dbs><db><returncode>05</returncode><errmsg>최대 31일까지 조회가능합니다.</errmsg></db></dbs>"));
    await expect(createKopis({ fetch, env: { KOPIS_API_KEY: "kk" } }).search({ q: "x" })).rejects.toThrow("최대 31일까지 조회가능합니다.");
  });

  it("looks a run up by its id", async () => {
    const { calls, fetch } = recorder(() => new Response(`<dbs><db><mt20id>PF132236</mt20id><prfnm>레미제라블</prfnm><entrpsnm>(주)레미제라블코리아</entrpsnm><sty>줄거리</sty></db></dbs>`));
    const kopis = createKopis({ fetch, env: { KOPIS_API_KEY: "kk" } });
    expect(await kopis.lookup("PF132236", "PERFORMANCE")).toMatchObject({ creator: "(주)레미제라블코리아", synopsis: "줄거리" });
    expect(calls[0].url).toContain("/pblprfr/PF132236?service=kk");
    expect(await kopis.lookup("../etc", "PERFORMANCE")).toBeNull();
  });
});

describe("Seoul cultural events provider", () => {
  const row = (over: Record<string, string>) => ({
    CODENAME: "전시/미술", TITLE: "특별전시 [DIMA]", PLACE: "서울백제어린이박물관", ORG_NAME: "송파구", PROGRAM: "",
    MAIN_IMG: "https://culture.seoul.go.kr/cmmn/file/getImage.do?atchFileId=a&thumb=Y", STRTDATE: "2026-11-01 00:00:00.0", END_DATE: "2027-02-28 00:00:00.0",
    HMPG_ADDR: "https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=160158&menuNo=200009", ...over,
  });
  const ok = (rows: unknown[]) => json({ culturalEventInfo: { list_total_count: rows.length, RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다" }, row: rows } });

  it("maps exhibitions and performances, skipping classes and rows without an id", async () => {
    const { calls, fetch } = recorder(() => ok([
      row({}),
      row({ CODENAME: "콘서트", TITLE: "재즈", HMPG_ADDR: "https://culture.seoul.go.kr/view.do?cultcode=158770&menuNo=200008" }),
      row({ CODENAME: "교육/체험", HMPG_ADDR: "https://culture.seoul.go.kr/view.do?cultcode=1" }),
      row({ HMPG_ADDR: "" }),
    ]));
    const found = await createSeoulCulture({ fetch, now, env: { SEOUL_OPENDATA_API_KEY: "sk" } }).search({ q: "전시", limit: 5 });

    found.forEach(fits);
    expect(found.map((w) => [w.externalId, w.medium])).toEqual([["160158", "EXHIBITION"], ["158770", "PERFORMANCE"]]);
    expect(found[0]).toMatchObject({
      releaseYear: 2026, expiresAt: null, license: "공공누리 1유형",
      event: { venue: "서울백제어린이박물관", startDate: "2026-11-01", endDate: "2027-02-28", genre: "전시/미술" },
    });
    expect(calls[0].url).toBe(`http://openapi.seoul.go.kr:8088/sk/json/culturalEventInfo/1/5/%20/${encodeURIComponent("전시")}`);
  });

  it("filters to exhibitions in the request, and treats 'no data' as an empty result", async () => {
    const some = recorder(() => ok([row({})]));
    await createSeoulCulture({ fetch: some.fetch, env: { SEOUL_OPENDATA_API_KEY: "sk" } }).search({ q: "x", medium: "EXHIBITION" });
    expect(some.calls[0].url).toContain(`/${encodeURIComponent("전시")}/x`);

    const none = recorder(() => json({ RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } }));
    expect(await createSeoulCulture({ fetch: none.fetch, env: { SEOUL_OPENDATA_API_KEY: "sk" } }).search({ q: "zzz" })).toEqual([]);
  });

  it("reads an error that comes back as XML", async () => {
    const { fetch } = recorder(() => new Response("<RESULT><CODE>ERROR-335</CODE><MESSAGE><![CDATA[한번에 최대 5건을 넘을 수 없습니다.]]></MESSAGE></RESULT>"));
    await expect(createSeoulCulture({ fetch, env: { SEOUL_OPENDATA_API_KEY: "sample" } }).search({ q: "x" })).rejects.toThrow("서울 열린데이터광장: 한번에 최대 5건을 넘을 수 없습니다.");
  });

  it("reports a rejected key", async () => {
    const { fetch } = recorder(() => json({ RESULT: { CODE: "INFO-100", MESSAGE: "인증키가 유효하지 않습니다." } }));
    await expect(createSeoulCulture({ fetch, env: { SEOUL_OPENDATA_API_KEY: "bad" } }).search({ q: "x" })).rejects.toThrow("인증키가 유효하지 않습니다.");
  });
});
