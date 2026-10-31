import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import { exhibitionItems, exhibitions, user, works, workTags } from "../schema";
import { SEED_WORKS, SEED_EXHIBITIONS, EDITORIAL_USER, DEMO_USER } from "./catalog";
import { TAG_BY_KEY } from "../recommendation/tags";
import { ARTWORK } from "./artwork";

/**
 * Idempotent seed: upserts catalog works + tags, the two system users and the editorial sample exhibitions.
 * User-created drafts are never touched, so it is safe to re-run.
 */
export async function seedDatabase(db: Db) {
  const now = new Date();
  return db.transaction(async (tx) => {
    for (const u of [
      { ...EDITORIAL_USER, email: "editorial@users.lecta.invalid", isEditorial: true },
      { ...DEMO_USER, email: "demo@users.lecta.invalid", isEditorial: false },
    ]) {
      await tx.insert(user).values({ id: u.id, name: u.displayName, email: u.email, isEditorial: u.isEditorial })
        .onConflictDoUpdate({ target: user.id, set: { name: u.displayName } });
    }

    for (const w of SEED_WORKS) {
      const art = ARTWORK[w.id];
      const row = {
        medium: w.medium, title: w.title, originalTitle: w.originalTitle ?? null, creator: w.creator, releaseYear: w.year, synopsis: w.synopsis,
        artworkUrl: art?.url ?? null, artworkSource: art ? "Wikipedia infobox (Wikimedia)" : null,
        artworkLicenseNote: art ? "Official artwork © its rights holder, shown for identification; hot-linked from Wikimedia." : null,
        sourceUrl: art?.sourcePage ?? null, coverTone: w.tone, updatedAt: now,
      };
      await tx.insert(works).values({ id: w.id, externalSource: "Lecta editorial", metadataStatus: "CURATED", createdAt: now, ...row })
        .onConflictDoUpdate({ target: works.id, set: row });
      await tx.delete(workTags).where(and(eq(workTags.workId, w.id), eq(workTags.provenance, "HUMAN_CURATED")));
      await tx.insert(workTags).values(w.tags.split(",").map((pair) => {
        const [key, weight] = pair.split(":");
        const def = TAG_BY_KEY[key];
        if (!def) throw new Error(`Unknown tag "${key}" on ${w.id}`);
        return { id: `t_${w.id}_${key}`, workId: w.id, tagKey: key, category: def.category, weight: Number(weight), provenance: "HUMAN_CURATED" as const, evidenceText: "curated interpretation", reviewed: true };
      }));
    }

    for (const ex of SEED_EXHIBITIONS) {
      await tx.insert(exhibitions).values({
        id: ex.id, ownerId: EDITORIAL_USER.id, slug: ex.id.replace(/^ex_/, "").replace(/_/g, "-"), title: ex.title, description: ex.description,
        visibility: "PUBLIC", isEditorial: true, number: ex.number, version: 1,
      }).onConflictDoUpdate({ target: exhibitions.id, set: { title: sql`excluded.title`, description: sql`excluded.description`, number: sql`excluded.number` } });
      await tx.delete(exhibitionItems).where(eq(exhibitionItems.exhibitionId, ex.id));
      await tx.insert(exhibitionItems).values(ex.items.map((it, i) => ({ id: `exi_${ex.id}_${i}`, exhibitionId: ex.id, workId: it.workId, position: i, curatorNote: it.note ?? null })));
    }
    // user-created exhibitions are numbered after the editorial samples
    return { works: SEED_WORKS.length, exhibitions: SEED_EXHIBITIONS.length };
  });
}
