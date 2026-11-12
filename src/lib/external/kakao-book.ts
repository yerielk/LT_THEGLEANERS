/**
 * Kakao (Daum) book search. The key is the app's REST API key, the same one Kakao login uses as its client id.
 *
 * externalId is the ISBN-13 (ISBN-10 when that is all Kakao has). Books without an ISBN are skipped:
 * there would be nothing to refetch them by once the cached metadata expires.
 */
import { clampLimit, getOrNull, requireKey, type Fetch } from "./http";
import { stamp, type ExternalMedium, type ExternalProvider, type ExternalSearchParams, type ExternalWork } from "./types";

const API = "https://dapi.kakao.com/v3/search/book";
const MEDIA = ["BOOK"] as const;

interface Doc {
  title: string;
  contents?: string;
  url?: string;
  isbn?: string; // "ISBN10 ISBN13", either may be missing
  datetime?: string;
  authors?: string[];
  thumbnail?: string;
}

export interface KakaoBookOptions {
  fetch?: Fetch;
  env?: Record<string, string | undefined>;
  now?: () => Date;
}

function isbnOf(doc: Doc): string | null {
  const parts = (doc.isbn ?? "").split(/\s+/).filter(Boolean);
  return parts.find((p) => p.length === 13) ?? parts[0] ?? null;
}

function toWork(doc: Doc, now: Date): ExternalWork | null {
  const isbn = isbnOf(doc);
  if (!isbn || !doc.title) return null;
  const page = doc.url || null;
  return {
    ...stamp("KAKAO_BOOK", now),
    externalId: isbn,
    medium: "BOOK",
    title: doc.title,
    originalTitle: null,
    creator: (doc.authors ?? []).join(", "),
    releaseYear: doc.datetime && /^\d{4}/.test(doc.datetime) ? Number(doc.datetime.slice(0, 4)) : null,
    synopsis: doc.contents?.trim() || null,
    artwork: doc.thumbnail ? { url: doc.thumbnail, credit: "Kakao 책 검색", sourcePage: page } : null,
    sourceUrl: page,
  };
}

export function createKakaoBook(opts: KakaoBookOptions = {}): ExternalProvider {
  const env = opts.env ?? process.env;
  const now = opts.now ?? (() => new Date());

  async function query(params: Record<string, string>): Promise<ExternalWork[]> {
    const key = requireKey("Kakao book search", env.KAKAO_REST_API_KEY || env.KAKAO_CLIENT_ID);
    const res = await getOrNull("Kakao book search", `${API}?${new URLSearchParams(params)}`, { headers: { Authorization: `KakaoAK ${key}` } }, opts.fetch);
    const data = res ? ((await res.json()) as { documents?: Doc[] }) : null;
    return (data?.documents ?? []).map((d) => toWork(d, now())).filter((w): w is ExternalWork => !!w);
  }

  return {
    source: "KAKAO_BOOK",
    media: MEDIA,
    async search({ q, medium, limit }: ExternalSearchParams) {
      const text = q.trim();
      if (!text || (medium && medium !== "BOOK")) return [];
      return query({ query: text, size: String(clampLimit(limit, 50)) });
    },
    async lookup(externalId: string, _medium: ExternalMedium) {
      if (!/^[0-9Xx]{10,13}$/.test(externalId)) return null;
      const found = await query({ query: externalId, target: "isbn", size: "1" });
      return found[0] ?? null;
    },
  };
}
