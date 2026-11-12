/**
 * MusicBrainz (albums and tracks) with Cover Art Archive covers. No API key.
 *
 * MusicBrainz asks for at most about one request a second per IP and a User-Agent that names the app and
 * a contact; going over makes it answer 503 to everything from that IP. All requests go through one queue.
 * https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
 */
import { LectaError } from "../services/errors";
import { stamp, type ExternalMedium, type ExternalProvider, type ExternalSearchParams, type ExternalWork } from "./types";

const API = "https://musicbrainz.org/ws/2";
// ListenBrainz (same foundation, CC0 statistics) ranks release groups by listens; MusicBrainz itself has no ranking
const TOP_ALBUMS = "https://api.listenbrainz.org/1/stats/sitewide/release-groups";
const YEAR_BATCH = 25;
const MIN_INTERVAL_MS = 1100;
const RETRY_AFTER_MS = 2000;
const MEDIA = ["ALBUM", "TRACK"] as const;

interface ArtistCredit { name: string; joinphrase?: string }
interface ReleaseGroup {
  id: string;
  title: string;
  "first-release-date"?: string;
  "secondary-types"?: string[];
  "artist-credit"?: ArtistCredit[];
}
interface Recording {
  id: string;
  title: string;
  "first-release-date"?: string;
  "artist-credit"?: ArtistCredit[];
  releases?: { "release-group"?: ReleaseGroup }[];
}

export interface MusicBrainzOptions {
  fetch?: typeof fetch;
  /** Injected in tests so they do not wait. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  userAgent?: string;
}

export function userAgent(env: Record<string, string | undefined> = process.env): string {
  const contact = env.MUSICBRAINZ_CONTACT?.trim() || "https://github.com/yerielk/LT_THEGLEANERS";
  return `Lecta/0.1.0 ( ${contact} )`;
}

const credit = (c?: ArtistCredit[]) => (c ?? []).map((a) => a.name + (a.joinphrase ?? "")).join("");
const year = (d?: string) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);
const escapeLucene = (q: string) => q.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");

/** Cover Art Archive redirects to the image, or answers 404 when the release group has no cover. */
function cover(releaseGroupId: string | undefined) {
  if (!releaseGroupId) return null;
  return {
    url: `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`,
    credit: "Cover Art Archive",
    sourcePage: `https://musicbrainz.org/release-group/${releaseGroupId}`,
  };
}

function fromReleaseGroup(g: ReleaseGroup, now: Date): ExternalWork {
  return {
    ...stamp("MUSICBRAINZ", now),
    externalId: g.id,
    medium: "ALBUM",
    title: g.title,
    originalTitle: null,
    creator: credit(g["artist-credit"]),
    releaseYear: year(g["first-release-date"]),
    synopsis: null,
    artwork: cover(g.id),
    sourceUrl: `https://musicbrainz.org/release-group/${g.id}`,
  };
}

function fromRecording(r: Recording, now: Date): ExternalWork {
  const groups = (r.releases ?? []).map((x) => x["release-group"]).filter((g): g is ReleaseGroup => !!g);
  // the track's own album or single reads better as a cover than a compilation it was collected on
  const group = groups.find((g) => !g["secondary-types"]?.includes("Compilation")) ?? groups[0];
  return {
    ...stamp("MUSICBRAINZ", now),
    externalId: r.id,
    medium: "TRACK",
    title: r.title,
    originalTitle: null,
    creator: credit(r["artist-credit"]),
    releaseYear: year(r["first-release-date"]),
    synopsis: null,
    artwork: cover(group?.id),
    sourceUrl: `https://musicbrainz.org/recording/${r.id}`,
  };
}

export function createMusicBrainz(opts: MusicBrainzOptions = {}): ExternalProvider {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const ua = opts.userAgent ?? userAgent();
  let queue: Promise<unknown> = Promise.resolve();
  let last = -Infinity;

  /** null on 404. Requests run one at a time, at least MIN_INTERVAL_MS apart. */
  function get<T>(path: string): Promise<T | null> {
    const run = async () => {
      const send = async () => {
        const wait = last + MIN_INTERVAL_MS - now();
        if (wait > 0) await sleep(wait);
        last = now();
        return (opts.fetch ?? fetch)(`${API}${path}`, { headers: { "User-Agent": ua, Accept: "application/json" } });
      };
      let res = await send();
      // MusicBrainz also answers 503 when the whole service is busy, even to a client inside its own limit
      if (res.status === 503) {
        await sleep(RETRY_AFTER_MS);
        res = await send();
      }
      if (res.status === 404) return null;
      if (res.status === 503 || res.status === 429) throw new LectaError("RATE_LIMITED", "MusicBrainz is rate limiting us");
      if (!res.ok) throw new LectaError("SERVICE_UNAVAILABLE", `MusicBrainz answered ${res.status}`);
      return (await res.json()) as T;
    };
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  }

  async function searchOne(medium: "ALBUM" | "TRACK", q: string, limit: number): Promise<ExternalWork[]> {
    const query = `?query=${encodeURIComponent(escapeLucene(q))}&fmt=json&limit=${limit}`;
    if (medium === "ALBUM") {
      const data = await get<{ "release-groups"?: ReleaseGroup[] }>(`/release-group${query}`);
      return (data?.["release-groups"] ?? []).map((g) => fromReleaseGroup(g, new Date(now())));
    }
    const data = await get<{ recordings?: Recording[] }>(`/recording${query}`);
    return (data?.recordings ?? []).map((r) => fromRecording(r, new Date(now())));
  }

  return {
    source: "MUSICBRAINZ",
    media: MEDIA,
    async popular(limit: number) {
      const want = Math.min(Math.max(limit, 1), 1000);
      const res = await (opts.fetch ?? fetch)(`${TOP_ALBUMS}?range=all_time&count=${want}`, { headers: { "User-Agent": ua, Accept: "application/json" } });
      if (!res.ok) throw new LectaError("SERVICE_UNAVAILABLE", `ListenBrainz answered ${res.status}`);
      const body = (await res.json()) as { payload?: { release_groups?: { release_group_mbid?: string; release_group_name?: string; artist_name?: string }[] } };
      const top = (body.payload?.release_groups ?? []).filter((g) => g.release_group_mbid && g.release_group_name);
      // the ranking has no dates: ask MusicBrainz for them a batch at a time, and go without a year if it will not answer
      const years = new Map<string, string | undefined>();
      for (let i = 0; i < top.length; i += YEAR_BATCH) {
        const ids = top.slice(i, i + YEAR_BATCH).map((g) => g.release_group_mbid!);
        const data = await get<{ "release-groups"?: ReleaseGroup[] }>(`/release-group?query=${encodeURIComponent(`rgid:(${ids.join(" OR ")})`)}&fmt=json&limit=${YEAR_BATCH}`).catch(() => null);
        for (const g of data?.["release-groups"] ?? []) years.set(g.id, g["first-release-date"]);
      }
      return top.map((g) => fromReleaseGroup({ id: g.release_group_mbid!, title: g.release_group_name!, "first-release-date": years.get(g.release_group_mbid!), "artist-credit": [{ name: g.artist_name ?? "" }] }, new Date(now())));
    },
    async search({ q, medium, limit = 10 }: ExternalSearchParams) {
      const text = q.trim();
      if (!text) return [];
      if (medium && medium !== "ALBUM" && medium !== "TRACK") return [];
      const n = Math.min(Math.max(limit, 1), 25);
      if (medium) return searchOne(medium, text, n);
      const albums = await searchOne("ALBUM", text, n);
      const tracks = await searchOne("TRACK", text, n);
      return [...albums, ...tracks];
    },
    async lookup(externalId: string, medium: ExternalMedium) {
      if (!/^[0-9a-f-]{36}$/i.test(externalId)) return null;
      if (medium === "ALBUM") {
        const g = await get<ReleaseGroup>(`/release-group/${externalId}?inc=artist-credits&fmt=json`);
        return g ? fromReleaseGroup(g, new Date(now())) : null;
      }
      if (medium === "TRACK") {
        const r = await get<Recording>(`/recording/${externalId}?inc=artist-credits+releases+release-groups&fmt=json`);
        return r ? fromRecording(r, new Date(now())) : null;
      }
      return null;
    },
  };
}
