/**
 * 서울시 문화행사 정보 (서울 열린데이터광장, 공공누리 1유형): exhibitions and performances in Seoul.
 *
 * The API has no id field and no lookup by id. externalId is the `cultcode` in the event's 서울문화포털 link;
 * rows without one are skipped, and lookup needs the title to find the event again. The API is served over plain http only, with the key in the path.
 */
import { LectaError } from "../services/errors";
import { clampLimit, getOrNull, requireKey, type Fetch } from "./http";
import { stamp, type ExternalMedium, type ExternalProvider, type ExternalSearchParams, type ExternalWork } from "./types";

const API = "http://openapi.seoul.go.kr:8088";
const MEDIA = ["EXHIBITION", "PERFORMANCE"] as const;
const EXHIBITION = "전시/미술";
const PAGE = 1000;

interface Row {
  CODENAME?: string;
  TITLE?: string;
  PLACE?: string;
  ORG_NAME?: string;
  PROGRAM?: string;
  MAIN_IMG?: string;
  STRTDATE?: string;
  END_DATE?: string;
  HMPG_ADDR?: string;
}
interface Answer {
  culturalEventInfo?: { RESULT?: { CODE: string; MESSAGE: string }; row?: Row[] };
  RESULT?: { CODE: string; MESSAGE: string };
}

export interface SeoulCultureOptions {
  fetch?: Fetch;
  env?: Record<string, string | undefined>;
  now?: () => Date;
}

const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

function toWork(r: Row, now: Date): ExternalWork | null {
  const id = /[?&]cultcode=(\d+)/.exec(r.HMPG_ADDR ?? "")?.[1];
  if (!id || !r.TITLE || r.CODENAME === "교육/체험") return null; // classes and workshops are not something to hang in a room
  const start = day(r.STRTDATE);
  return {
    ...stamp("SEOUL_CULTURE", now),
    externalId: id,
    medium: r.CODENAME === EXHIBITION ? "EXHIBITION" : "PERFORMANCE",
    title: r.TITLE,
    originalTitle: null,
    creator: r.ORG_NAME ?? "",
    releaseYear: start ? Number(start.slice(0, 4)) : null,
    synopsis: r.PROGRAM?.trim() || null,
    artwork: /^https:\/\//.test(r.MAIN_IMG ?? "") ? { url: r.MAIN_IMG!, credit: "서울문화포털", sourcePage: r.HMPG_ADDR! } : null,
    event: { venue: r.PLACE || null, startDate: start, endDate: day(r.END_DATE), genre: r.CODENAME || null, workTitle: null },
    sourceUrl: r.HMPG_ADDR!,
  };
}

export function createSeoulCulture(opts: SeoulCultureOptions = {}): ExternalProvider {
  const env = opts.env ?? process.env;
  const now = opts.now ?? (() => new Date());

  /** Rows from..to (1-based) of the event list, optionally narrowed by codename and title. */
  async function rows(from: number, to: number, codename: string, title?: string): Promise<ExternalWork[]> {
      const key = requireKey("서울 열린데이터광장", env.SEOUL_OPENDATA_API_KEY);
      // path: /{key}/json/culturalEventInfo/{from}/{to}/{codename}/{title}; a blank codename is a single space.
      // The codename matches by prefix, and "전시/미술" cannot be sent whole: its slash splits the path.
      const url = `${API}/${encodeURIComponent(key)}/json/culturalEventInfo/${from}/${to}/${encodeURIComponent(codename)}${title ? `/${encodeURIComponent(title)}` : ""}`;
      const res = await getOrNull("서울 열린데이터광장", url, {}, opts.fetch);
      const body = res ? await res.text() : "{}";
      // some errors come back as XML even when JSON was asked for
      const xml = /<CODE>([^<]+)<\/CODE>\s*<MESSAGE>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/MESSAGE>/.exec(body);
      const data: Answer = xml ? { RESULT: { CODE: xml[1], MESSAGE: xml[2].trim() } } : JSON.parse(body);
      const result = data.culturalEventInfo?.RESULT ?? data.RESULT;
      if (result?.CODE === "INFO-200") return []; // no rows
      if (result && result.CODE !== "INFO-000") throw new LectaError("SERVICE_UNAVAILABLE", `서울 열린데이터광장: ${result.MESSAGE}`, false);
      return (data.culturalEventInfo?.row ?? []).map((r) => toWork(r, now())).filter((w): w is ExternalWork => !!w);
  }

  const provider: ExternalProvider = {
    source: "SEOUL_CULTURE",
    media: MEDIA,
    async search({ q, medium, limit }: ExternalSearchParams) {
      const text = q.trim();
      if (!text || (medium && medium !== "EXHIBITION" && medium !== "PERFORMANCE")) return [];
      const works = await rows(1, clampLimit(limit, 50), medium === "EXHIBITION" ? "전시" : " ", text);
      return medium === "PERFORMANCE" ? works.filter((w) => w.medium === "PERFORMANCE") : works;
    },
    /** Exhibitions in the order the API lists them. The source has no measure of how well known one is. */
    async popular(limit: number) {
      const want = Math.min(Math.max(limit, 1), 3000);
      const found: ExternalWork[] = [];
      // one request returns 1,000 rows at most
      for (let from = 1; found.length < want; from += PAGE) {
        const batch = await rows(from, from + PAGE - 1, "전시");
        found.push(...batch.filter((w) => w.medium === "EXHIBITION"));
        if (batch.length === 0) break;
      }
      return found.slice(0, want);
    },
    /** The API cannot look an event up by id, so the event is found again by its title and matched on the id. */
    async lookup(externalId: string, _medium: ExternalMedium, hint?: { title?: string }) {
      if (!hint?.title?.trim()) return null;
      const found = await provider.search({ q: hint.title, limit: 50 });
      return found.find((w) => w.externalId === externalId) ?? null;
    },
  };
  return provider;
}
