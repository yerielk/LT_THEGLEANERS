import { getDb, type Db } from "../db";
import { listFeatured, type ExhibitionView } from "./exhibitions";
import type { Actor } from "./actor";

/**
 * What the home page shows: one recommended curation (the panorama) and a row of popular ones.
 *
 * Both are random for now: there are no likes or view counts yet, and taste-based curation matching is not built.
 * `pickRecommended` and `rankPopular` are the two places to swap in real logic (the /welcome taste picks,
 * like counts) without touching the page.
 */

export const POPULAR_LIMIT = 6;

type Rand = () => number;

export function pickRecommended(all: ExhibitionView[], rand: Rand): ExhibitionView | null {
  const withWorks = all.filter((e) => e.items.length > 0);
  if (withWorks.length === 0) return null;
  return withWorks[Math.floor(rand() * withWorks.length)];
}

export function rankPopular(all: ExhibitionView[], rand: Rand): ExhibitionView[] {
  const out = [...all];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function homePicks(actor: Actor, db: Db = getDb(), rand: Rand = Math.random): Promise<{ pick: ExhibitionView | null; popular: ExhibitionView[] }> {
  const all = await listFeatured(actor, db);
  const pick = pickRecommended(all, rand);
  const popular = rankPopular(all.filter((e) => e.id !== pick?.id && e.items.length > 0), rand).slice(0, POPULAR_LIMIT);
  return { pick, popular };
}
