/**
 * 서울시 문화행사 정보 (서울 열린데이터광장, 공공누리 1유형): exhibitions and performances in Seoul.
 *
 * The API has no id field and no lookup by id. externalId is the `cultcode` in the event's 서울문화포털 link;
 * rows without one are skipped. The API is served over plain http only, with the key in the path.
 */
import { LectaError } from "../services/errors";
import { clampLimit, getOrNull, requireKey, type Fetch } from "./http";
import { stamp, type ExternalMedium, type ExternalProvider, type ExternalSearchParams, type ExternalWork } from "./types";

const API = "http://openapi.seoul.go.kr:8088";
const MEDIA = ["EXHIBITION", "PERFORMANCE"] as const;
const EXHIBITION = "전시/미술";

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
    event: { venue: r.PLACE || null, startDate: start, endDate: day(r.END_DATE), genre: r.CODENAME || null },
    sourceUrl: r.HMPG_ADDR!,
  };
}

export function createSeoulCulture(opts: SeoulCultureOptions = {}): ExternalProvider {
  const env = opts.env ?? process.env;
  const now = opts.now ?? (() => new Date());

  return {
    source: "SEOUL_CULTURE",
    media: MEDIA,
    async search({ q, medium, limit }: ExternalSearchParams) {
      const text = q.trim();
      if (!text || (medium && medium !== "EXHIBITION" && medium !== "PERFORMANCE")) return [];
      const key = requireKey("서울 열린데이터광장", env.SEOUL_OPENDATA_API_KEY);
      // path: /{key}/json/culturalEventInfo/{from}/{to}/{codename}/{title}; a blank codename is a single space.
      // The codename matches by prefix, and "전시/미술" cannot be sent whole: its slash splits the path.
      const codename = medium === "EXHIBITION" ? "전시" : " ";
      const url = `${API}/${encodeURIComponent(key)}/json/culturalEventInfo/1/${clampLimit(limit, 50)}/${encodeURIComponent(codename)}/${encodeURIComponent(text)}`;
      const res = await getOrNull("서울 열린데이터광장", url, {}, opts.fetch);
      const body = res ? await res.text() : "{}";
      // some errors come back as XML even when JSON was asked for
      const xml = /<CODE>([^<]+)<\/CODE>\s*<MESSAGE>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/MESSAGE>/.exec(body);
      const data: Answer = xml ? { RESULT: { CODE: xml[1], MESSAGE: xml[2].trim() } } : JSON.parse(body);
      const result = data.culturalEventInfo?.RESULT ?? data.RESULT;
      if (result?.CODE === "INFO-200") return []; // no rows
      if (result && result.CODE !== "INFO-000") throw new LectaError("SERVICE_UNAVAILABLE", `서울 열린데이터광장: ${result.MESSAGE}`, false);
      const works = (data.culturalEventInfo?.row ?? []).map((r) => toWork(r, now())).filter((w): w is ExternalWork => !!w);
      return medium === "PERFORMANCE" ? works.filter((w) => w.medium === "PERFORMANCE") : works;
    },
    /** The API cannot look an event up by id; what was saved stays as saved (the licence lets us keep it). */
    async lookup(_externalId: string, _medium: ExternalMedium) {
      return null;
    },
  };
}
