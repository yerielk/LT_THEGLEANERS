/**
 * TMDB (films and series). Uses the v4 read access token when set, else the v3 API key.
 *
 * Movie and TV ids overlap, so externalId is "movie:<id>" or "tv:<id>".
 * Terms: attribution and logo required, cache under 6 months, posters hotlinked from image.tmdb.org.
 */
import { clampLimit, getOrNull, requireKey, type Fetch } from "./http";
import { stamp, type ExternalMedium, type ExternalProvider, type ExternalSearchParams, type ExternalWork } from "./types";

const API = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p/w342";
const MEDIA = ["FILM", "SERIES"] as const;
type Kind = "movie" | "tv";

interface Item {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  credits?: { crew?: { job: string; name: string }[] };
  created_by?: { name: string }[];
}

export interface TmdbOptions {
  fetch?: Fetch;
  env?: Record<string, string | undefined>;
  language?: string;
  now?: () => Date;
}

const year = (d?: string) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);

function toWork(kind: Kind, it: Item, now: Date): ExternalWork {
  const title = (kind === "movie" ? it.title : it.name) ?? "";
  const original = (kind === "movie" ? it.original_title : it.original_name) ?? null;
  // search results carry no credits; lookup fills the director or the creators in
  const creators = kind === "movie" ? (it.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name) : (it.created_by ?? []).map((c) => c.name);
  const page = `https://www.themoviedb.org/${kind}/${it.id}`;
  return {
    ...stamp("TMDB", now),
    externalId: `${kind}:${it.id}`,
    medium: kind === "movie" ? "FILM" : "SERIES",
    title,
    originalTitle: original && original !== title ? original : null,
    creator: creators.join(", "),
    releaseYear: year(kind === "movie" ? it.release_date : it.first_air_date),
    synopsis: it.overview?.trim() || null,
    artwork: it.poster_path ? { url: `${IMAGE}${it.poster_path}`, credit: "TMDB", sourcePage: page } : null,
    sourceUrl: page,
  };
}

export function createTmdb(opts: TmdbOptions = {}): ExternalProvider {
  const env = opts.env ?? process.env;
  const language = opts.language ?? "ko-KR";
  const now = opts.now ?? (() => new Date());

  async function get<T>(path: string, params: Record<string, string>): Promise<T | null> {
    const token = env.TMDB_READ_ACCESS_TOKEN?.trim();
    const query = new URLSearchParams({ ...params, language });
    if (!token) query.set("api_key", requireKey("TMDB", env.TMDB_API_KEY));
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await getOrNull("TMDB", `${API}${path}?${query}`, { headers }, opts.fetch);
    return res ? ((await res.json()) as T) : null;
  }

  async function searchKind(kind: Kind, q: string, limit: number) {
    const data = await get<{ results?: Item[] }>(`/search/${kind}`, { query: q, include_adult: "false" });
    return (data?.results ?? []).filter((it) => (kind === "movie" ? it.title : it.name)).slice(0, limit).map((it) => toWork(kind, it, now()));
  }

  /** Runs `job` over `items`, a few at a time: TMDB allows about 40 requests a second. */
  async function pooled<T, R>(items: T[], job: (item: T) => Promise<R>, size = 8): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) { const i = next++; out[i] = await job(items[i]); }
    }));
    return out;
  }

  return {
    source: "TMDB",
    media: MEDIA,
    /** Films with the most votes: a steadier measure of "well known" than TMDB's day-to-day popularity. */
    async popular(limit: number) {
      const want = Math.min(Math.max(limit, 1), 2000);
      const listed: Item[] = [];
      for (let page = 1; listed.length < want; page++) {
        const data = await get<{ results?: Item[] }>("/discover/movie", { sort_by: "vote_count.desc", include_adult: "false", page: String(page) });
        const batch = (data?.results ?? []).filter((it) => it.title);
        listed.push(...batch);
        if (batch.length === 0) break;
      }
      // the list has no credits: fetch each film once more for its director, and keep the listed one if that fails
      return pooled(listed.slice(0, want), async (it) => {
        const full = await get<Item>(`/movie/${it.id}`, { append_to_response: "credits" }).catch(() => null);
        return toWork("movie", full ?? it, now());
      });
    },
    async search({ q, medium, limit }: ExternalSearchParams) {
      const text = q.trim();
      if (!text) return [];
      if (medium && medium !== "FILM" && medium !== "SERIES") return [];
      const n = clampLimit(limit, 20);
      if (medium) return searchKind(medium === "FILM" ? "movie" : "tv", text, n);
      const [films, series] = await Promise.all([searchKind("movie", text, n), searchKind("tv", text, n)]);
      return [...films, ...series];
    },
    async lookup(externalId: string, _medium: ExternalMedium) {
      const m = /^(movie|tv):(\d+)$/.exec(externalId);
      if (!m) return null;
      const kind = m[1] as Kind;
      const it = await get<Item>(`/${kind}/${m[2]}`, kind === "movie" ? { append_to_response: "credits" } : {});
      return it ? toWork(kind, it, now()) : null;
    },
  };
}
