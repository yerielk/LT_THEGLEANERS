import { asc, desc, inArray } from "drizzle-orm";
import { getDb, type Db } from "../db";
import { works, workTags } from "../schema";
import { LectaError } from "./errors";
import { normalize } from "../recommendation/tags";
import { queryTagWeights } from "../recommendation/search-tags";
import type { Medium } from "../data/catalog";
import { ARTWORK } from "../data/artwork";
import { SOURCE_POLICY, type ExternalSource } from "../external/types";

export interface WorkTagView {
  key: string;
  category: string;
  weight: number;
  provenance: string;
}

export interface WorkView {
  id: string;
  medium: Medium;
  title: string;
  originalTitle: string | null;
  creator: string;
  releaseYear: number | null;
  synopsis: string | null;
  artworkUrl: string | null;
  artwork: { url: string; width: number; height: number; credit: string; sourcePage: string | null } | null;
  coverTone: string | null;
  metadataStatus: "VERIFIED" | "CURATED" | "INCOMPLETE";
  source: { name: string; url: string | null; note: string; attribution: string | null };
  /** Venue, dates and genre of a performance or exhibition. null for everything else. */
  event: Row["event"];
  tags: WorkTagView[];
  tagKeys: string[];
}

type Row = typeof works.$inferSelect;

// The shelf order of an unfiltered catalog. A Record so that adding a medium without placing it here fails to compile:
// a medium missing from the interleave once made the loop below never end.
const SHELF: Record<Medium, number> = { FILM: 0, BOOK: 1, ALBUM: 2, SERIES: 3, TRACK: 4, PERFORMANCE: 5, EXHIBITION: 6 };
const MEDIA_ORDER = (Object.keys(SHELF) as Medium[]).sort((a, b) => SHELF[a] - SHELF[b]);

function sourceOf(r: Row) {
  return {
    name: r.externalSource || "Lecta editorial",
    url: null as string | null,
    // what the source's terms ask us to show next to its data
    attribution: SOURCE_POLICY[r.externalSource as ExternalSource]?.attribution ?? null,
    note:
      r.metadataStatus === "VERIFIED"
        ? "Metadata verified against the external source."
        : "Title, creator and year entered by the team (CURATED). Tags are the team's curated interpretation.",
  };
}

function toView(r: Row, tags: WorkTagView[]): WorkView {
  return {
    id: r.id,
    medium: r.medium,
    title: r.title,
    originalTitle: r.originalTitle,
    creator: r.creator,
    releaseYear: r.releaseYear,
    synopsis: r.synopsis,
    artworkUrl: r.artworkUrl,
    artwork: r.artworkUrl
      ? {
          url: r.artworkUrl,
          width: ARTWORK[r.id]?.width ?? 300,
          height: ARTWORK[r.id]?.height ?? (r.medium === "ALBUM" ? 300 : 450),
          credit: r.artworkSource ?? "external",
          sourcePage: r.sourceUrl,
        }
      : null,
    coverTone: r.coverTone,
    metadataStatus: r.metadataStatus,
    source: sourceOf(r),
    event: r.event,
    tags,
    tagKeys: tags.map((t) => t.key),
  };
}

async function tagsByWork(db: Db, ids?: string[]): Promise<Map<string, WorkTagView[]>> {
  const rows = await db
    .select()
    .from(workTags)
    .where(ids?.length ? inArray(workTags.workId, ids) : undefined)
    .orderBy(desc(workTags.weight), asc(workTags.tagKey));
  const map = new Map<string, WorkTagView[]>();
  for (const t of rows) {
    const list = map.get(t.workId) ?? [];
    list.push({ key: t.tagKey, category: t.category, weight: t.weight, provenance: t.provenance });
    map.set(t.workId, list);
  }
  return map;
}

export async function allWorks(db: Db = getDb()): Promise<WorkView[]> {
  const [rows, tags] = await Promise.all([db.select().from(works).orderBy(asc(works.id)), tagsByWork(db)]);
  return rows.map((r) => toView(r, tags.get(r.id) ?? []));
}

export async function getWorksByIds(ids: string[], db: Db = getDb()): Promise<WorkView[]> {
  if (!ids.length) return [];
  const [rows, tags] = await Promise.all([db.select().from(works).where(inArray(works.id, ids)), tagsByWork(db, ids)]);
  const byId = new Map(rows.map((r) => [r.id, toView(r, tags.get(r.id) ?? [])]));
  return ids.map((id) => byId.get(id)).filter((w): w is WorkView => !!w);
}

export async function getWork(id: string, db: Db = getDb()): Promise<WorkView> {
  const [w] = await getWorksByIds([id], db);
  if (!w) throw new LectaError("WORK_NOT_FOUND", `No work with id "${id}"`);
  return w;
}

/** Search title and creator text together with weighted vocabulary tag similarity. */
export async function searchWorks(
  params: { q?: string; medium?: Medium; limit?: number },
  db: Db = getDb(),
): Promise<{ works: WorkView[]; total: number }> {
  const q = params.q ? normalize(params.q) : "";
  let works = await allWorks(db);
  if (params.medium) works = works.filter((w) => w.medium === params.medium);
  if (q) {
    const queryTags = queryTagWeights(params.q ?? "", 0.62);
    const queryTagTotal = [...queryTags.values()].reduce((sum, weight) => sum + weight, 0);
    const scored = works
      .map((w) => {
        const fields = [w.title, w.originalTitle ?? "", w.creator].map(normalize);
        const titleScore = fields[0] === q || fields[1] === q ? 12
          : fields[0].includes(q) || fields[1].includes(q) ? 8 : 0;
        const creatorScore = fields[2] === q ? 10 : fields[2].includes(q) ? 6 : 0;
        const synopsisScore = normalize(w.synopsis ?? "").includes(q) ? 1.5 : 0;

        const workTags = new Map<string, number>();
        for (const tag of w.tags) workTags.set(tag.key, Math.max(workTags.get(tag.key) ?? 0, Math.max(0, Math.min(1, tag.weight))));
        let weightedFit = 0;
        let bestTagFit = 0;
        for (const [key, queryWeight] of queryTags) {
          const match = queryWeight * (workTags.get(key) ?? 0);
          weightedFit += match;
          bestTagFit = Math.max(bestTagFit, match);
        }
        const averageTagFit = queryTagTotal ? weightedFit / queryTagTotal : 0;
        const tagScore = (bestTagFit * 0.65 + averageTagFit * 0.35) * 8;
        const s = Math.max(titleScore, creatorScore, synopsisScore, tagScore >= 1.8 ? tagScore : 0);
        return { w, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.w.id.localeCompare(b.w.id));
    works = scored.map((x) => x.w);
  }
  if (!q && !params.medium) {
    // catalog order: interleave media so the archive reads like a mixed shelf, not grouped by type
    const buckets = MEDIA_ORDER.map((m) => works.filter((w) => w.medium === m));
    const longest = Math.max(0, ...buckets.map((b) => b.length));
    const mixed: WorkView[] = [];
    for (let i = 0; i < longest; i++) for (const b of buckets) if (b[i]) mixed.push(b[i]);
    works = mixed;
  }
  const total = works.length;
  return { works: works.slice(0, params.limit ?? 48), total };
}
