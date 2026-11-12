/**
 * The contract between external catalogs, our services, the web UI and MCP tools.
 *
 * Every provider (TMDB, Aladin, MusicBrainz, KOPIS, ...) turns its own response into an `ExternalWork`.
 * What we may keep, and for how long, differs per source: see SOURCE_POLICY and docs/Lecta_데이터확보_조사.md.
 * Image files are never copied to our storage; `artwork.url` always points at the source's own server.
 */
import { z } from "zod";

export const EXTERNAL_SOURCES = [
  "TMDB",
  "ALADIN",
  "KAKAO_BOOK",
  "MUSICBRAINZ",
  "KOPIS",
  "CULTURE_PORTAL",
  "SEOUL_CULTURE",
  "WIKIDATA",
] as const;
export type ExternalSource = (typeof EXTERNAL_SOURCES)[number];

/** Wider than the `medium` enum in the DB: TRACK, PERFORMANCE and EXHIBITION are not stored yet. */
export const EXTERNAL_MEDIA = ["FILM", "SERIES", "BOOK", "ALBUM", "TRACK", "PERFORMANCE", "EXHIBITION"] as const;
export type ExternalMedium = (typeof EXTERNAL_MEDIA)[number];

export interface SourcePolicy {
  /** PERMANENT: the licence lets us keep the metadata. CACHE: keep only ids for good, refetch the rest. */
  metadata: "PERMANENT" | "CACHE";
  /** Days cached metadata may live before it must be refetched. null when metadata is PERMANENT. */
  cacheDays: number | null;
  license: string;
  /** Shown wherever this source's data or images appear. */
  attribution: string;
}

export const SOURCE_POLICY: Record<ExternalSource, SourcePolicy> = {
  // API terms 1.C: no caching beyond 6 months. Kept well under that.
  TMDB: { metadata: "CACHE", cacheDays: 90, license: "TMDB API Terms of Use (non-commercial)", attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB." },
  // Terms 7.3(3) forbid storing or caching beyond what the terms allow: keep it short until Aladin answers.
  ALADIN: { metadata: "CACHE", cacheDays: 1, license: "알라딘 Open API 이용약관", attribution: "도서 DB 제공: 알라딘" },
  KAKAO_BOOK: { metadata: "CACHE", cacheDays: 1, license: "카카오 API 운영정책", attribution: "Kakao 책 검색" },
  MUSICBRAINZ: { metadata: "PERMANENT", cacheDays: null, license: "CC0 (MusicBrainz core data)", attribution: "MusicBrainz, Cover Art Archive" },
  KOPIS: { metadata: "PERMANENT", cacheDays: null, license: "공공데이터 (KOPIS Open API)", attribution: "출처: (재)예술경영지원센터 공연예술통합전산망(www.kopis.or.kr)" },
  CULTURE_PORTAL: { metadata: "PERMANENT", cacheDays: null, license: "공공데이터 (이용허락범위 제한 없음)", attribution: "출처: 한국문화정보원 문화포털" },
  SEOUL_CULTURE: { metadata: "PERMANENT", cacheDays: null, license: "공공누리 1유형", attribution: "출처: 서울특별시 서울문화포털" },
  WIKIDATA: { metadata: "PERMANENT", cacheDays: null, license: "CC0", attribution: "Wikidata" },
};

const isoDate = z.string().datetime();

export const externalArtworkSchema = z.object({
  /** Hotlinked from the source. Never a URL on our own storage. */
  url: z.string().url(),
  credit: z.string().min(1),
  sourcePage: z.string().url().nullable(),
});

/** Only for PERFORMANCE and EXHIBITION: a run at one venue, not the work itself. Dates are YYYY-MM-DD. */
export const externalEventSchema = z.object({
  venue: z.string().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** The source's own genre label, e.g. KOPIS "뮤지컬". */
  genre: z.string().nullable(),
});

export const externalWorkSchema = z.object({
  source: z.enum(EXTERNAL_SOURCES),
  externalId: z.string().min(1).max(128),
  medium: z.enum(EXTERNAL_MEDIA),
  title: z.string().min(1),
  originalTitle: z.string().nullable(),
  creator: z.string(),
  releaseYear: z.number().int().nullable(),
  synopsis: z.string().nullable(),
  artwork: externalArtworkSchema.nullable(),
  event: externalEventSchema.optional(),
  /** The work's page on the source, for the attribution link. */
  sourceUrl: z.string().url().nullable(),
  license: z.string().min(1),
  fetchedAt: isoDate,
  /** When cached metadata must be refetched by id. null when the source lets us keep it. */
  expiresAt: isoDate.nullable(),
});
export type ExternalWork = z.infer<typeof externalWorkSchema>;

export interface ExternalSearchParams {
  q: string;
  medium?: ExternalMedium;
  limit?: number;
}

export interface ExternalProvider {
  readonly source: ExternalSource;
  readonly media: readonly ExternalMedium[];
  search(params: ExternalSearchParams): Promise<ExternalWork[]>;
  /** null when the source has no such id. */
  lookup(externalId: string, medium: ExternalMedium): Promise<ExternalWork | null>;
}

/** Stamps the licence and expiry that SOURCE_POLICY sets for the source. */
export function stamp(source: ExternalSource, now: Date = new Date()): Pick<ExternalWork, "source" | "license" | "fetchedAt" | "expiresAt"> {
  const policy = SOURCE_POLICY[source];
  return {
    source,
    license: policy.license,
    fetchedAt: now.toISOString(),
    expiresAt: policy.cacheDays === null ? null : new Date(now.getTime() + policy.cacheDays * 86_400_000).toISOString(),
  };
}
