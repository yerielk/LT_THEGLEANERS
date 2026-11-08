import { asc, desc, inArray } from "drizzle-orm";
import { getDb, type Db } from "../db";
import { works, workTags } from "../schema";
import { LectaError } from "./errors";
import { normalize, TAG_BY_KEY } from "../recommendation/tags";
import type { Medium } from "../data/catalog";
import { ARTWORK } from "../data/artwork";

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
  source: { name: string; url: string | null; note: string };
  tags: WorkTagView[];
  tagKeys: string[];
}

type Row = typeof works.$inferSelect;

function sourceOf(r: Row) {
  return {
    name: r.externalSource || "Lecta editorial",
    url: null as string | null,
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

/** Search across title, original title, creator, synopsis and tags (English key or Korean label). */
export async function searchWorks(
  params: { q?: string; medium?: Medium; limit?: number },
  db: Db = getDb(),
): Promise<{ works: WorkView[]; total: number }> {
  const q = params.q ? normalize(params.q) : "";
  let works = await allWorks(db);
  if (params.medium) works = works.filter((w) => w.medium === params.medium);
  if (q) {
    const scored = works
      .map((w) => {
        const fields = [w.title, w.originalTitle ?? "", w.creator].map(normalize);
        const tagText = w.tags.map((t) => `${t.key.replace(/_/g, " ")} ${TAG_BY_KEY[t.key]?.ko ?? ""}`).join(" ").toLowerCase();
        let s = 0;
        if (fields[0].includes(q) || fields[1].includes(q)) s += 3;
        if (fields[2].includes(q)) s += 2;
        // tags match on word starts so "longing" does not hit "belonging"; Korean labels match as substrings
        const isHangul = /[가-힣]/.test(q);
        if (isHangul ? tagText.includes(q) : new RegExp(`(^|\\s)${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(tagText)) s += 1.5;
        if (normalize(w.synopsis ?? "").includes(q)) s += 1;
        return { w, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.w.id.localeCompare(b.w.id));
    works = scored.map((x) => x.w);
  }
  if (!q && !params.medium) {
    // catalog order: interleave media so the archive reads like a mixed shelf, not grouped by type
    const order = ["FILM", "BOOK", "ALBUM", "SERIES"] as const;
    const buckets = order.map((m) => works.filter((w) => w.medium === m));
    const mixed: WorkView[] = [];
    for (let i = 0; mixed.length < works.length; i++) for (const b of buckets) if (b[i]) mixed.push(b[i]);
    works = mixed;
  }
  const total = works.length;
  return { works: works.slice(0, params.limit ?? 48), total };
}
