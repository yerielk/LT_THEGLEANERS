import { describe, it, expect, vi } from "vitest";
import { createMusicBrainz, userAgent } from "../src/lib/external/musicbrainz";
import { externalWorkSchema, stamp, SOURCE_POLICY, EXTERNAL_SOURCES } from "../src/lib/external/types";

const GROUP = {
  id: "9ad6d1a2-7495-4d0c-9aad-de058bfb1493",
  title: "꽃갈피",
  "first-release-date": "2014-05-16",
  "artist-credit": [{ name: "IU" }],
};
const RECORDING = {
  id: "cf3b2fd9-e6cc-49bf-abf3-63a3af75a6dc",
  title: "밤편지",
  "first-release-date": "2017-03-24",
  "artist-credit": [{ name: "IU", joinphrase: " & " }, { name: "Someone" }],
  releases: [
    { "release-group": { id: "6b63852f-0892-4bea-b603-597aaca629db", title: "Smash Hits 2", "secondary-types": ["Compilation"] } },
    { "release-group": { id: "11111111-2222-3333-4444-555555555555", title: "Palette" } },
  ],
};

/** A clock that only moves when the provider sleeps, so tests never wait. */
function harness(reply: (url: string) => Response) {
  let t = 0;
  const sleeps: number[] = [];
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const mb = createMusicBrainz({
    now: () => t,
    sleep: async (ms) => { sleeps.push(ms); t += ms; },
    userAgent: "Lecta/test ( test )",
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string> });
      return reply(url);
    }) as typeof fetch,
  });
  return { mb, sleeps, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("external work contract", () => {
  it("has a storage policy for every source, with a cache window only for sources we may not keep", () => {
    for (const s of EXTERNAL_SOURCES) {
      const p = SOURCE_POLICY[s];
      expect(p.metadata === "CACHE" ? p.cacheDays : null).toBe(p.cacheDays);
    }
    expect(SOURCE_POLICY.TMDB.cacheDays).toBeLessThan(180);
  });

  it("stamps an expiry for cached sources and none for sources we may keep", () => {
    const now = new Date("2026-11-10T00:00:00.000Z");
    expect(stamp("MUSICBRAINZ", now).expiresAt).toBeNull();
    expect(stamp("ALADIN", now).expiresAt).toBe("2026-11-11T00:00:00.000Z");
  });
});

describe("MusicBrainz provider", () => {
  it("turns a release group into an album that fits the contract, with a hotlinked cover", async () => {
    const { mb, calls } = harness(() => json({ "release-groups": [GROUP] }));
    const [album] = await mb.search({ q: "아이유 꽃갈피", medium: "ALBUM" });

    expect(externalWorkSchema.parse(album)).toEqual(album);
    expect(album).toMatchObject({
      source: "MUSICBRAINZ", externalId: GROUP.id, medium: "ALBUM", title: "꽃갈피", creator: "IU", releaseYear: 2014,
      expiresAt: null,
      artwork: { url: `https://coverartarchive.org/release-group/${GROUP.id}/front-250`, credit: "Cover Art Archive" },
    });
    expect(calls[0].url).toContain("/release-group?query=");
    expect(calls[0].headers["User-Agent"]).toBe("Lecta/test ( test )");
  });

  it("joins credited artists and prefers the track's own release over a compilation for the cover", async () => {
    const { mb } = harness(() => json({ recordings: [RECORDING] }));
    const [track] = await mb.search({ q: "밤편지", medium: "TRACK" });

    expect(track).toMatchObject({ medium: "TRACK", creator: "IU & Someone", releaseYear: 2017 });
    expect(track.artwork?.url).toContain("11111111-2222-3333-4444-555555555555");
  });

  it("searches albums then tracks when no medium is given, at least 1.1s apart", async () => {
    const { mb, calls, sleeps } = harness((url) => json(url.includes("/recording") ? { recordings: [RECORDING] } : { "release-groups": [GROUP] }));
    const found = await mb.search({ q: "IU" });

    expect(found.map((w) => w.medium)).toEqual(["ALBUM", "TRACK"]);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([1100]);
  });

  it("keeps concurrent callers in one queue", async () => {
    const { mb, sleeps } = harness(() => json({ "release-groups": [] }));
    await Promise.all([1, 2, 3].map(() => mb.search({ q: "x", medium: "ALBUM" })));
    expect(sleeps).toEqual([1100, 1100]);
  });

  it("escapes Lucene syntax in the user's text", async () => {
    const { mb, calls } = harness(() => json({ "release-groups": [] }));
    await mb.search({ q: 'AC/DC: "Back"', medium: "ALBUM" });
    expect(decodeURIComponent(calls[0].url.split("query=")[1].split("&")[0])).toBe('AC\\/DC\\: \\"Back\\"');
  });

  it("does not call out for blank text or media it does not cover", async () => {
    const { mb, calls } = harness(() => json({}));
    expect(await mb.search({ q: "   " })).toEqual([]);
    expect(await mb.search({ q: "Parasite", medium: "FILM" })).toEqual([]);
    expect(await mb.lookup("not-an-mbid", "ALBUM")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("looks an album up by id and answers null when MusicBrainz has none", async () => {
    const hit = harness(() => json(GROUP));
    expect(await hit.mb.lookup(GROUP.id, "ALBUM")).toMatchObject({ externalId: GROUP.id, title: "꽃갈피" });
    expect(hit.calls[0].url).toContain(`/release-group/${GROUP.id}?inc=artist-credits`);

    const miss = harness(() => json({ error: "Not Found" }, 404));
    expect(await miss.mb.lookup(GROUP.id, "ALBUM")).toBeNull();
  });

  it("retries a single 503 after a pause", async () => {
    let n = 0;
    const { mb, calls, sleeps } = harness(() => (n++ === 0 ? json({}, 503) : json({ "release-groups": [GROUP] })));
    expect(await mb.search({ q: "x", medium: "ALBUM" })).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it("reports a repeated 503 as retryable rate limiting and keeps serving the next caller", async () => {
    let n = 0;
    const { mb } = harness(() => (n++ < 2 ? json({}, 503) : json({ "release-groups": [GROUP] })));
    await expect(mb.search({ q: "x", medium: "ALBUM" })).rejects.toMatchObject({ code: "RATE_LIMITED", retryable: true });
    expect(await mb.search({ q: "x", medium: "ALBUM" })).toHaveLength(1);
  });

  it("names the app and a contact in the User-Agent", () => {
    expect(userAgent({})).toBe("Lecta/0.1.0 ( https://github.com/yerielk/LT_THEGLEANERS )");
    expect(userAgent({ MUSICBRAINZ_CONTACT: " team@example.com " })).toBe("Lecta/0.1.0 ( team@example.com )");
  });
});
