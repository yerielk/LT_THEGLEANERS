import type { DatabaseSync } from "node:sqlite";
import { getDb } from "../db";
import { LectaError } from "./errors";
import { normalize, TAG_BY_KEY } from "../recommendation/tags";
import type { Medium } from "../data/catalog";

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
  coverTone: string | null;
  metadataStatus: "VERIFIED" | "CURATED" | "INCOMPLETE";
  source: { name: string; url: string | null; note: string };
  tags: WorkTagView[];
  tagKeys: string[];
}

type Row = Record<string, unknown>;

function sourceOf(r: Row) {
  const status = r.metadata_status as string;
  return {
    name: (r.external_source as string) || "Lecta editorial",
    url: (r.source_url as string) || null,
    note:
      status === "VERIFIED"
        ? "Metadata verified against the external source."
        : "Title, creator and year entered by the team (CURATED). Tags are the team's curated interpretation.",
  };
}

function toView(r: Row, tags: WorkTagView[]): WorkView {
  return {
    id: r.id as string,
    medium: r.medium as Medium,
    title: r.title as string,
    originalTitle: (r.original_title as string) ?? null,
    creator: r.creator as string,
    releaseYear: (r.release_year as number) ?? null,
    synopsis: (r.synopsis as string) ?? null,
    artworkUrl: (r.artwork_url as string) ?? null,
    coverTone: (r.cover_tone as string) ?? null,
    metadataStatus: r.metadata_status as WorkView["metadataStatus"],
    source: sourceOf(r),
    tags,
    tagKeys: tags.map((t) => t.key),
  };
}

function tagsByWork(db: DatabaseSync, ids?: string[]): Map<string, WorkTagView[]> {
  const rows = (
    ids?.length
      ? db
          .prepare(`SELECT * FROM work_tags WHERE work_id IN (${ids.map(() => "?").join(",")}) ORDER BY weight DESC, tag_key`)
          .all(...ids)
      : db.prepare("SELECT * FROM work_tags ORDER BY weight DESC, tag_key").all()
  ) as Row[];
  const map = new Map<string, WorkTagView[]>();
  for (const t of rows) {
    const list = map.get(t.work_id as string) ?? [];
    list.push({ key: t.tag_key as string, category: t.category as string, weight: t.weight as number, provenance: t.provenance as string });
    map.set(t.work_id as string, list);
  }
  return map;
}

export function allWorks(db: DatabaseSync = getDb()): WorkView[] {
  const rows = db.prepare("SELECT * FROM works ORDER BY id").all() as Row[];
  const tags = tagsByWork(db);
  return rows.map((r) => toView(r, tags.get(r.id as string) ?? []));
}

export function getWorksByIds(ids: string[], db: DatabaseSync = getDb()): WorkView[] {
  if (!ids.length) return [];
  const rows = db.prepare(`SELECT * FROM works WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids) as Row[];
  const tags = tagsByWork(db, ids);
  const byId = new Map(rows.map((r) => [r.id as string, toView(r, tags.get(r.id as string) ?? [])]));
  return ids.map((id) => byId.get(id)).filter((w): w is WorkView => !!w);
}

export function getWork(id: string, db: DatabaseSync = getDb()): WorkView {
  const [w] = getWorksByIds([id], db);
  if (!w) throw new LectaError("WORK_NOT_FOUND", `No work with id "${id}"`);
  return w;
}

/** Search across title, original title, creator, synopsis and tags (English key or Korean label). */
export function searchWorks(
  params: { q?: string; medium?: Medium; limit?: number },
  db: DatabaseSync = getDb(),
): { works: WorkView[]; total: number } {
  const q = params.q ? normalize(params.q) : "";
  let works = allWorks(db);
  if (params.medium) works = works.filter((w) => w.medium === params.medium);
  if (q) {
    const scored = works
      .map((w) => {
        const fields = [w.title, w.originalTitle ?? "", w.creator].map(normalize);
        const tagText = w.tags.map((t) => `${t.key.replace(/_/g, " ")} ${TAG_BY_KEY[t.key]?.ko ?? ""}`).join(" ").toLowerCase();
        let s = 0;
        if (fields[0].includes(q) || fields[1].includes(q)) s += 3;
        if (fields[2].includes(q)) s += 2;
        if (tagText.includes(q)) s += 1.5;
        if (normalize(w.synopsis ?? "").includes(q)) s += 1;
        return { w, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.w.id.localeCompare(b.w.id));
    works = scored.map((x) => x.w);
  }
  const total = works.length;
  return { works: works.slice(0, params.limit ?? 48), total };
}
