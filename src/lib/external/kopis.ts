/**
 * KOPIS (공연예술통합전산망): performances in Korea, including musicals, classical/opera and pop concerts.
 *
 * Every record is one run at one venue (mt20id), not the work itself. Answers are XML only.
 * The list endpoint needs a date window. The guide says 31 days at most, but measured on 2026-11-12
 * a search by title accepts ten years, so past runs are searched by default.
 * Posters are listed as http but are also served over https, which is what we link.
 * More than 10 requests a second gets the key suspended.
 */
import { LectaError } from "../services/errors";
import { clampLimit, getOrNull, requireKey, type Fetch } from "./http";
import { stamp, type ExternalMedium, type ExternalProvider, type ExternalSearchParams, type ExternalWork } from "./types";

const API = "http://kopis.or.kr/openApi/restful/pblprfr";
const MEDIA = ["PERFORMANCE"] as const;
const DAY = 86_400_000;
const PAGE_SIZE = 100;
const MAX_RESULTS = 300;

export interface KopisOptions {
  fetch?: Fetch;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  /** Runs overlapping [today - daysBack, today + daysAhead] are searched. */
  daysBack?: number;
  daysAhead?: number;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
    )
    .trim();

/** Each <db> record as a flat map of its leaf tags. Nested lists (styurls, relates) are ignored. */
export function parseDbs(xml: string): Record<string, string>[] {
  return [...xml.matchAll(/<db>([\s\S]*?)<\/db>/g)].map(([, body]) => {
    const rec: Record<string, string> = {};
    for (const [, tag, value] of body.matchAll(/<(\w+)>((?:<!\[CDATA\[[\s\S]*?\]\]>|[^<])*)<\/\1>/g)) rec[tag] ??= decode(value);
    return rec;
  });
}

/**
 * The work a run belongs to, as far as the title tells: "레미제라블 [구미]" and "레미제라블 [청주]" are one work.
 * KOPIS has no id for the work itself, so runs can only be grouped by this.
 */
export function workTitleOf(prfnm: string): string {
  return prfnm
    .replace(/\[[^\]]*\]/g, " ") // tour stops and venues: [구미], [대학로]
    .replace(/\((앙코르|앵콜|재공연|내한공연|내한)\)/g, " ")
    .replace(/(^|\s)(앙코르|앵콜)(?=\s|$)/g, " ")
    .replace(/^\s*(19|20)\d{2}\s+/, "") // a leading season year
    .replace(/\s+/g, " ")
    .trim() || prfnm.trim();
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const isoDay = (s?: string) => (s && /^\d{4}\.\d{2}\.\d{2}$/.test(s) ? s.replace(/\./g, "-") : null);

function toWork(r: Record<string, string>, now: Date): ExternalWork | null {
  if (!r.mt20id || !r.prfnm) return null;
  const page = `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?mt20Id=${r.mt20id}`;
  const start = isoDay(r.prfpdfrom);
  return {
    ...stamp("KOPIS", now),
    externalId: r.mt20id,
    medium: "PERFORMANCE",
    title: r.prfnm,
    originalTitle: null,
    // the list has no credits; the detail names the producing company
    creator: r.entrpsnm ?? "",
    releaseYear: start ? Number(start.slice(0, 4)) : null,
    synopsis: r.sty || null,
    artwork: /^https?:\/\//.test(r.poster ?? "") ? { url: r.poster.replace(/^http:/, "https:"), credit: "KOPIS", sourcePage: page } : null,
    event: { venue: r.fcltynm || null, startDate: start, endDate: isoDay(r.prfpdto), genre: r.genrenm || null, workTitle: workTitleOf(r.prfnm) },
    sourceUrl: page,
  };
}

export function createKopis(opts: KopisOptions = {}): ExternalProvider {
  const env = opts.env ?? process.env;
  const now = opts.now ?? (() => new Date());

  async function get(path: string, params: Record<string, string>): Promise<Record<string, string>[]> {
    const query = new URLSearchParams({ service: requireKey("KOPIS", env.KOPIS_API_KEY), ...params });
    const res = await getOrNull("KOPIS", `${API}${path}?${query}`, {}, opts.fetch);
    const records = res ? parseDbs(await res.text()) : [];
    // KOPIS reports its own errors (bad key, window too wide) inside a 200 answer
    const failed = records.find((r) => r.returncode && r.returncode !== "00");
    if (failed) throw new LectaError("SERVICE_UNAVAILABLE", `KOPIS: ${failed.errmsg ?? failed.returncode}`, false);
    return records;
  }

  return {
    source: "KOPIS",
    media: MEDIA,
    async search({ q, medium, limit }: ExternalSearchParams) {
      const text = q.trim();
      if (!text || (medium && medium !== "PERFORMANCE")) return [];
      const today = now().getTime();
      const want = clampLimit(limit, MAX_RESULTS);
      const rows = Math.min(want, PAGE_SIZE);
      const records: Record<string, string>[] = [];
      // one page holds 100 runs at most; pages are fetched one after another to stay far below 10 requests a second
      for (let page = 1; records.length < want; page++) {
        const batch = await get("", {
          stdate: ymd(new Date(today - (opts.daysBack ?? 3650) * DAY)),
          eddate: ymd(new Date(today + (opts.daysAhead ?? 90) * DAY)),
          cpage: String(page),
          rows: String(rows),
          shprfnm: text,
        });
        records.push(...batch);
        if (batch.length < rows) break;
      }
      return records.slice(0, want).map((r) => toWork(r, now())).filter((w): w is ExternalWork => !!w);
    },
    async lookup(externalId: string, _medium: ExternalMedium) {
      if (!/^PF\d+$/.test(externalId)) return null;
      const [record] = await get(`/${externalId}`, {});
      return record ? toWork(record, now()) : null;
    },
  };
}
