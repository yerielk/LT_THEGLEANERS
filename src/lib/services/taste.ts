import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, newId, type Db } from "../db";
import { tasteSignals } from "../schema";
import { getWorksByIds, type WorkView } from "./works";
import { LectaError } from "./errors";
import type { Actor } from "./actor";
import { tagLabel } from "../recommendation/tags";
import { recommend, type Recommendation } from "../recommendation/engine";
import { zodMessage } from "../validators";
import type { Medium } from "../data/catalog";

/**
 * First-run taste survey: the user picks works they already love, like picking artists when a music app opens
 * for the first time. Picks are stored as LIKED taste signals with no exhibition attached, so they stay apart
 * from the CURATED signals an exhibition writes. Saving again replaces the previous picks.
 */
export const ONBOARDING_MIN = 3;
/** The recommender takes at most 16 seed works. */
export const ONBOARDING_MAX = 16;

const id = z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_\-]+$/, "invalid id");
export const onboardingSchema = z.object({
  workIds: z
    .array(id)
    .min(ONBOARDING_MIN, `pick at least ${ONBOARDING_MIN} works`)
    .max(ONBOARDING_MAX, `pick at most ${ONBOARDING_MAX} works`)
    .refine((ids) => new Set(ids).size === ids.length, "works must not repeat"),
});

export interface TasteProfile {
  /** Strongest tags across the picks, summed by weight. */
  tags: { key: string; label: string; weight: number; workCount: number }[];
  /** How many picks fall in each medium, most first. */
  media: { medium: Medium; count: number }[];
}

export interface TasteView {
  workIds: string[];
  profile: TasteProfile;
}

export interface SavedTaste extends TasteView {
  recommendations: Recommendation[];
}

/** Picks without a matching tag still count toward media; ties break by key so the result is stable. */
export function buildProfile(works: WorkView[], topTags = 5): TasteProfile {
  const tags = new Map<string, { weight: number; workCount: number }>();
  const media = new Map<Medium, number>();
  for (const w of works) {
    media.set(w.medium, (media.get(w.medium) ?? 0) + 1);
    for (const t of w.tags) {
      const cur = tags.get(t.key) ?? { weight: 0, workCount: 0 };
      tags.set(t.key, { weight: cur.weight + t.weight, workCount: cur.workCount + 1 });
    }
  }
  return {
    tags: [...tags]
      .sort((a, b) => b[1].weight - a[1].weight || a[0].localeCompare(b[0]))
      .slice(0, topTags)
      .map(([key, v]) => ({ key, label: tagLabel(key), weight: Math.round(v.weight * 100) / 100, workCount: v.workCount })),
    media: [...media].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([medium, count]) => ({ medium, count })),
  };
}

const onboardingPicks = (userId: string) =>
  and(eq(tasteSignals.userId, userId), eq(tasteSignals.signalType, "LIKED"), isNull(tasteSignals.exhibitionId));

export async function getTaste(actor: Actor, db: Db = getDb()): Promise<TasteView> {
  if (!actor.userId) return { workIds: [], profile: { tags: [], media: [] } };
  const rows = await db.select({ workId: tasteSignals.workId }).from(tasteSignals).where(onboardingPicks(actor.userId)).orderBy(asc(tasteSignals.createdAt), asc(tasteSignals.id));
  const works = await getWorksByIds(rows.map((r) => r.workId).filter((x): x is string => !!x), db);
  return { workIds: works.map((w) => w.id), profile: buildProfile(works) };
}

export async function saveTaste(input: unknown, actor: Actor, db: Db = getDb()): Promise<SavedTaste> {
  if (!actor.userId) throw new LectaError("UNAUTHORIZED", "Sign in to save your taste.");
  const userId = actor.userId;
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const { workIds } = parsed.data;

  const works = await getWorksByIds(workIds, db);
  const missing = workIds.filter((w) => !works.some((x) => x.id === w));
  if (missing.length) throw new LectaError("WORK_NOT_FOUND", `Unknown work id(s): ${missing.join(", ")}`, false, { missing });

  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(tasteSignals).where(onboardingPicks(userId));
    await tx.insert(tasteSignals).values(
      works.map((w, i) => ({
        id: newId("sig"), userId, workId: w.id, signalType: "LIKED" as const, origin: "USER_EXPLICIT" as const,
        structuredTags: w.tagKeys.length ? w.tagKeys : null,
        // keep the order the user picked them in
        createdAt: new Date(now + i),
      })),
    );
  });

  let recommendations: Recommendation[] = [];
  try {
    recommendations = (await recommend({ seedWorkIds: workIds, limit: 3 }, actor, db)).recommendations;
  } catch (e) {
    // the picks are saved either way; an empty pool (every work picked) just means nothing to suggest
    if (!(e instanceof LectaError && e.code === "RECOMMENDATION_EMPTY")) throw e;
  }
  return { workIds: works.map((w) => w.id), profile: buildProfile(works), recommendations };
}
