import { getDb, type Db } from "../db";
import { listFeatured, type ExhibitionView } from "./exhibitions";
import type { Actor } from "./actor";
import { normalize, tagLabel } from "../recommendation/tags";

/**
 * Curation search: public exhibitions found by keyword.
 *
 * Ranking is plain keyword matching for now. `scoreCuration` is the one place to swap in better ranking
 * (work-based matching, embedding similarity) without touching the API or the page.
 */

export interface CurationHit {
  curation: ExhibitionView;
  score: number;
  /** Which parts matched, for showing why a curation came up. */
  matched: ("title" | "description" | "work" | "note" | "tag" | "curator")[];
}

const has = (text: string | null | undefined, q: string) => !!text && normalize(text).includes(q);

export function scoreCuration(ex: ExhibitionView, q: string): Omit<CurationHit, "curation"> {
  const matched: CurationHit["matched"] = [];
  let score = 0;
  if (has(ex.title, q)) { score += 4; matched.push("title"); }
  if (has(ex.description, q)) { score += 2; matched.push("description"); }
  if (ex.items.some((i) => has(i.work.title, q) || has(i.work.originalTitle, q) || has(i.work.creator, q))) { score += 3; matched.push("work"); }
  if (ex.items.some((i) => has(i.curatorNote, q))) { score += 1.5; matched.push("note"); }
  if (ex.items.some((i) => i.work.tagKeys.some((k) => has(tagLabel(k), q) || has(k.replace(/_/g, " "), q)))) { score += 1; matched.push("tag"); }
  if (has(ex.ownerName, q)) { score += 1; matched.push("curator"); }
  return { score, matched };
}

export async function searchCurations(params: { q?: string; limit?: number }, actor: Actor, db: Db = getDb()): Promise<{ curations: CurationHit[]; total: number }> {
  const all = await listFeatured(actor, db);
  const q = params.q ? normalize(params.q) : "";
  const hits = q
    ? all
        .map((curation) => ({ curation, ...scoreCuration(curation, q) }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score || a.curation.number - b.curation.number)
    : all.map((curation) => ({ curation, score: 0, matched: [] }));
  return { curations: hits.slice(0, params.limit ?? 48), total: hits.length };
}
