import { getDb, type Db } from "../db";
import { listFeatured, type ExhibitionView } from "./exhibitions";
import type { Actor } from "./actor";
import { getTaste } from "./taste";
import { curationLikeCounts, likedWorkIds } from "./library";
import { getWorksByIds, type WorkView } from "./works";
import { recommend } from "../recommendation/engine";
import { LectaError } from "./errors";

/**
 * What the home page shows: one recommended curation (the panorama), a row of popular ones,
 * and a row of works.
 *
 * With no taste on record everything is random, as before. Once a person has picked favourites at
 * /welcome or liked works, those become the taste: the recommended curation is one whose works share
 * their tags, popular curations are ordered by likes, and the works row comes from the recommender.
 */

export const POPULAR_LIMIT = 6;
const WORKS_LIMIT = 10;

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

/** Tag weights summed over the works a person chose, scaled so the strongest tag is 1. */
export function tasteVector(works: WorkView[]): Map<string, number> {
  const vec = new Map<string, number>();
  for (const w of works) for (const t of w.tags) vec.set(t.key, (vec.get(t.key) ?? 0) + t.weight);
  const top = Math.max(0, ...vec.values());
  if (top > 0) for (const [k, v] of vec) vec.set(k, v / top);
  return vec;
}

/** How well a curation's works match a taste, averaged over its works so long curations do not win by size. */
export function tasteMatch(ex: ExhibitionView, taste: Map<string, number>): number {
  if (!taste.size || !ex.items.length) return 0;
  let sum = 0;
  for (const { work } of ex.items) for (const t of work.tags) sum += (taste.get(t.key) ?? 0) * t.weight;
  return sum / ex.items.length;
}

export interface HomePicks {
  pick: ExhibitionView | null;
  popular: ExhibitionView[];
  /** Works for this person, or null when there is no taste to go on. */
  works: WorkView[] | null;
  personalised: boolean;
}

export async function homePicks(actor: Actor, db: Db = getDb(), rand: Rand = Math.random): Promise<HomePicks> {
  const all = (await listFeatured(actor, db)).filter((e) => e.items.length > 0);

  let seeds: WorkView[] = [];
  if (actor.userId) {
    const [taste, liked] = await Promise.all([getTaste(actor, db), likedWorkIds(actor.userId, db)]);
    // recent likes first: they say more about today than the first-run picks
    const ids = [...new Set([...liked, ...taste.workIds])].slice(0, 16);
    seeds = await getWorksByIds(ids, db);
  }
  const taste = tasteVector(seeds);
  const personalised = taste.size > 0;

  let pick: ExhibitionView | null;
  if (personalised) {
    const ranked = all.filter((e) => !e.isOwner).map((e) => ({ e, score: tasteMatch(e, taste) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    // one of the three closest, so the page still changes between visits
    const top = ranked.slice(0, 3);
    pick = top.length ? top[Math.floor(rand() * top.length)].e : pickRecommended(all, rand);
  } else {
    pick = pickRecommended(all, rand);
  }

  const rest = rankPopular(all.filter((e) => e.id !== pick?.id), rand);
  const likes = await curationLikeCounts(rest.map((e) => e.id), db);
  // likes decide; the shuffle above breaks ties, so an unliked catalogue still rotates
  const popular = rest.map((e, i) => ({ e, i })).sort((a, b) => (likes.get(b.e.id) ?? 0) - (likes.get(a.e.id) ?? 0) || a.i - b.i).slice(0, POPULAR_LIMIT).map((x) => x.e);

  let works: WorkView[] | null = null;
  if (personalised) {
    try {
      const result = await recommend({ seedWorkIds: seeds.map((w) => w.id), limit: WORKS_LIMIT }, actor, db, { log: false });
      const found = await getWorksByIds(result.recommendations.map((r) => r.workId), db);
      const byId = new Map(found.map((w) => [w.id, w]));
      works = result.recommendations.map((r) => byId.get(r.workId)).filter((w): w is WorkView => !!w);
      if (!works.length) works = null;
    } catch (e) {
      if (!(e instanceof LectaError)) throw e;
    }
  }
  return { pick, popular, works, personalised };
}
