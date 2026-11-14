import { eq, inArray, max } from "drizzle-orm";
import type { Db } from "../db";
import { exhibitionItems, exhibitions, user, works, workTags } from "../schema";
import { SEED_WORKS, SEED_EXHIBITIONS, CURATION_DEMO_EXHIBITIONS, EDITORIAL_USER, DEMO_USER } from "./catalog";
import { normalize, TAG_BY_KEY } from "../recommendation/tags";
import curationManifestJson from "./curation-manifest.json" with { type: "json" };
import { curationManifestSchema } from "./curation-manifest";
import { ARTWORK } from "./artwork";

/**
 * Idempotent, additive seed: existing rows are preserved; only missing catalog and editorial sample rows are added.
 */
export async function seedDatabase(db: Db) {
  const now = new Date();
  return db.transaction(async (tx) => {
    for (const u of [
      { ...EDITORIAL_USER, email: "editorial@users.lecta.invalid", isEditorial: true },
      { ...DEMO_USER, email: "demo@users.lecta.invalid", isEditorial: false },
    ]) {
      await tx.insert(user).values({ id: u.id, name: u.displayName, email: u.email, isEditorial: u.isEditorial })
        .onConflictDoNothing();
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
        .onConflictDoNothing();
      await tx.insert(workTags).values(w.tags.split(",").map((pair) => {
        const [key, weight] = pair.split(":");
        const def = TAG_BY_KEY[key];
        if (!def) throw new Error(`Unknown tag "${key}" on ${w.id}`);
        return { id: `t_${w.id}_${key}`, workId: w.id, tagKey: key, category: def.category, weight: Number(weight), provenance: "HUMAN_CURATED" as const, evidenceText: "curated interpretation", reviewed: true };
      })).onConflictDoNothing();
    }

    for (const ex of SEED_EXHIBITIONS) {
      const [existing] = await tx.select({ ownerId: exhibitions.ownerId, isEditorial: exhibitions.isEditorial })
        .from(exhibitions).where(eq(exhibitions.id, ex.id));
      if (existing && (existing.ownerId !== EDITORIAL_USER.id || !existing.isEditorial)) continue;
      if (!existing) await tx.insert(exhibitions).values({
        id: ex.id, ownerId: EDITORIAL_USER.id, slug: ex.id.replace(/^ex_/, "").replace(/_/g, "-"), title: ex.title, description: ex.description,
        visibility: "PUBLIC", isEditorial: true, number: ex.number, version: 1,
      }).onConflictDoNothing({ target: exhibitions.id });
      await tx.insert(exhibitionItems).values(ex.items.map((it, i) => ({ id: `exi_${ex.id}_${i}`, exhibitionId: ex.id, workId: it.workId, position: i, curatorNote: it.note ?? null })))
        .onConflictDoNothing();
    }
    // Stable IDs make these public recommendation demos safe to seed on local and deployed databases.
    for (const ex of CURATION_DEMO_EXHIBITIONS) {
      const [existing] = await tx.select({ ownerId: exhibitions.ownerId, isEditorial: exhibitions.isEditorial })
        .from(exhibitions).where(eq(exhibitions.id, ex.id));
      if (existing && (existing.ownerId !== EDITORIAL_USER.id || !existing.isEditorial)) continue;
      if (!existing) await tx.insert(exhibitions).values({
        id: ex.id, ownerId: EDITORIAL_USER.id, slug: ex.id.replace(/^ex_/, "").replace(/_/g, "-"), title: ex.title, description: ex.description,
        visibility: "PUBLIC", isEditorial: true, number: ex.number, version: 1,
      }).onConflictDoNothing({ target: exhibitions.id });
      await tx.insert(exhibitionItems).values(ex.items.map((it, i) => ({ id: `exi_${ex.id}_${i}`, exhibitionId: ex.id, workId: it.workId, position: i, curatorNote: it.note ?? null })))
        .onConflictDoNothing();
    }
    const manifest = curationManifestSchema.parse(curationManifestJson);
    const manifestWorkIds = [...new Set([
      ...manifest.curations.flatMap((item) => item.works.map((work) => work.id)),
      ...manifest.tagEvidence.map((item) => item.work.id),
    ])];
    const manifestWorks = manifestWorkIds.length
      ? await tx.select({ id: works.id, title: works.title, medium: works.medium, creator: works.creator, externalSource: works.externalSource })
        .from(works).where(inArray(works.id, manifestWorkIds))
      : [];
    const workById = new Map(manifestWorks.map((work) => [work.id, work]));
    const matchesReference = (ref: { id: string; title: string; medium: string; creator: string }) => {
      const found = workById.get(ref.id);
      return Boolean(found && found.medium === ref.medium && normalize(found.title) === normalize(ref.title) &&
        normalize(found.creator) === normalize(ref.creator));
    };

    const manifestIds = manifest.curations.map((item) => item.id);
    const existingManifestRows = manifestIds.length
      ? await tx.select({ id: exhibitions.id, ownerId: exhibitions.ownerId, title: exhibitions.title,
        description: exhibitions.description, visibility: exhibitions.visibility, isEditorial: exhibitions.isEditorial,
        slug: exhibitions.slug }).from(exhibitions).where(inArray(exhibitions.id, manifestIds))
      : [];
    const existingManifestById = new Map(existingManifestRows.map((row) => [row.id, row]));
    const manifestSlugs = manifest.curations.map((item) => item.id.replace(/^ex_/, "").replace(/_/g, "-"));
    const occupiedManifestSlugs = manifestSlugs.length
      ? await tx.select({ id: exhibitions.id, slug: exhibitions.slug }).from(exhibitions).where(inArray(exhibitions.slug, manifestSlugs))
      : [];
    const slugOwner = new Map(occupiedManifestSlugs.map((row) => [row.slug, row.id]));
    const existingManifestItems = manifestIds.length
      ? await tx.select({ exhibitionId: exhibitionItems.exhibitionId, workId: exhibitionItems.workId })
        .from(exhibitionItems).where(inArray(exhibitionItems.exhibitionId, manifestIds))
      : [];
    const itemsByCuration = new Map<string, Set<string>>();
    for (const item of existingManifestItems) {
      const linked = itemsByCuration.get(item.exhibitionId) ?? new Set<string>();
      linked.add(item.workId);
      itemsByCuration.set(item.exhibitionId, linked);
    }

    const safeCurations = manifest.curations.filter((item) => {
      if (!item.works.every(matchesReference)) return false;
      const existing = existingManifestById.get(item.id);
      if (existing && (existing.ownerId !== EDITORIAL_USER.id || !existing.isEditorial || existing.visibility !== "PUBLIC" ||
        existing.description !== item.description)) return false;
      const linked = itemsByCuration.get(item.id) ?? new Set<string>();
      if ([...linked].some((workId) => !item.works.some((work) => work.id === workId))) return false;
      const slug = item.id.replace(/^ex_/, "").replace(/_/g, "-");
      const occupyingId = slugOwner.get(slug);
      return !occupyingId || occupyingId === item.id;
    });

    // Existing editorial rows may reference works outside this local seed catalog.
    // Their title can still be reconciled independently without touching links or copy.
    for (const item of manifest.curations) {
      const existing = existingManifestById.get(item.id);
      if (existing && existing.ownerId === EDITORIAL_USER.id && existing.isEditorial &&
        existing.visibility === "PUBLIC" && existing.title !== item.title) {
        await tx.update(exhibitions).set({ title: item.title }).where(eq(exhibitions.id, item.id));
      }
    }

    if (safeCurations.length) {
      const [{ currentMax }] = await tx.select({ currentMax: max(exhibitions.number) }).from(exhibitions);
      let nextNumber = (currentMax ?? 0) + 1;
      for (const item of safeCurations) {
        if (!existingManifestById.has(item.id)) {
          await tx.insert(exhibitions).values({
            id: item.id, ownerId: EDITORIAL_USER.id, slug: item.id.replace(/^ex_/, "").replace(/_/g, "-"),
            title: item.title, description: item.description, visibility: "PUBLIC", isEditorial: true,
            number: nextNumber++, version: 1,
          }).onConflictDoNothing({ target: exhibitions.id });
        } else if (existingManifestById.get(item.id)?.title !== item.title) {
          await tx.update(exhibitions).set({ title: item.title }).where(eq(exhibitions.id, item.id));
        }
        const linked = itemsByCuration.get(item.id) ?? new Set<string>();
        const missing = item.works.filter((work) => !linked.has(work.id));
        if (missing.length) await tx.insert(exhibitionItems).values(missing.map((work) => ({
          id: `exi_${item.id}_${item.works.findIndex((ref) => ref.id === work.id)}`,
          exhibitionId: item.id, workId: work.id, position: item.works.findIndex((ref) => ref.id === work.id), curatorNote: null,
        }))).onConflictDoNothing();
      }
    }

    const tagsToSeed = manifest.tagEvidence.filter((item) => matchesReference(item.work) && TAG_BY_KEY[item.tagKey] &&
      workById.get(item.work.id)?.externalSource !== "TMDB");
    for (const item of tagsToSeed) {
      const def = TAG_BY_KEY[item.tagKey];
      await tx.insert(workTags).values({
        id: `t_${item.work.id}_${item.tagKey}`, workId: item.work.id, tagKey: item.tagKey,
        category: def.category, weight: item.weight, provenance: "HUMAN_CURATED" as const, evidenceText: item.rationale, reviewed: true,
      }).onConflictDoNothing();
    }
    // user-created exhibitions are numbered after the editorial samples
    return { works: SEED_WORKS.length, exhibitions: SEED_EXHIBITIONS.length + CURATION_DEMO_EXHIBITIONS.length + safeCurations.length };
  });
}
