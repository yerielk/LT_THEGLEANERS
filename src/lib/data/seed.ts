import { and, eq, inArray, like, max, notInArray } from "drizzle-orm";
import type { Db } from "../db";
import { exhibitionItems, exhibitions, user, works, workTags } from "../schema";
import { SEED_WORKS, SEED_EXHIBITIONS, CURATION_DEMO_EXHIBITIONS, EDITORIAL_USER, DEMO_USER } from "./catalog";
import { normalize, TAG_BY_KEY } from "../recommendation/tags";
import curationManifestJson from "./curation-manifest.json" with { type: "json" };
import { curationManifestSchema } from "./curation-manifest";
import { ARTWORK } from "./artwork";
import type { CurationDocument } from "../curation/document";

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
      ? await tx.select({ id: exhibitions.id, ownerId: exhibitions.ownerId, visibility: exhibitions.visibility, isEditorial: exhibitions.isEditorial })
        .from(exhibitions).where(inArray(exhibitions.id, manifestIds))
      : [];
    const existingManifestById = new Map(existingManifestRows.map((row) => [row.id, row]));
    const slugOf = (id: string) => id.replace(/^ex_/, "").replace(/_/g, "-");
    const manifestSlugs = manifestIds.map(slugOf);
    const occupiedManifestSlugs = manifestSlugs.length
      ? await tx.select({ id: exhibitions.id, slug: exhibitions.slug }).from(exhibitions).where(inArray(exhibitions.slug, manifestSlugs))
      : [];
    const slugOwner = new Map(occupiedManifestSlugs.map((row) => [row.slug, row.id]));

    // A manifest curation is seeded only when every referenced work exists with matching metadata,
    // and never over a row that a person owns.
    const safeCurations = manifest.curations.filter((item) => {
      if (!item.works.every(matchesReference)) return false;
      const existing = existingManifestById.get(item.id);
      if (existing && (existing.ownerId !== EDITORIAL_USER.id || !existing.isEditorial || existing.visibility !== "PUBLIC")) return false;
      const occupyingId = slugOwner.get(slugOf(item.id));
      return !occupyingId || occupyingId === item.id;
    });

    // The manifest is the source of truth for editorial demo curations: copy, order and notes are
    // reconciled on every run, and demo curations dropped from the manifest are retired.
    // User-owned rows never match these conditions.
    const retired = await tx.delete(exhibitions).where(and(
      eq(exhibitions.ownerId, EDITORIAL_USER.id), eq(exhibitions.isEditorial, true), like(exhibitions.id, "ex\\_blog\\_%"),
      manifestIds.length ? notInArray(exhibitions.id, manifestIds) : undefined,
    )).returning({ id: exhibitions.id });

    if (safeCurations.length) {
      const [{ currentMax }] = await tx.select({ currentMax: max(exhibitions.number) }).from(exhibitions);
      let nextNumber = (currentMax ?? 0) + 1;
      for (const item of safeCurations) {
        const document: CurationDocument = {
          title: item.title, subtitle: item.subtitle, curator: item.curator, intro: item.description, template: item.template, accentIndex: null,
          items: item.works.map((work) => ({
            id: work.id, title: work.title, creator: work.creator, year: "", medium: work.medium.toLowerCase(),
            reason: work.reason, note: work.note, layout: "" as const, featured: false, cover: null, scenes: [], palette: null,
          })),
        };
        if (!existingManifestById.has(item.id)) {
          await tx.insert(exhibitions).values({
            id: item.id, ownerId: EDITORIAL_USER.id, slug: slugOf(item.id), title: item.title, description: item.description,
            curationData: document, visibility: "PUBLIC", isEditorial: true, number: nextNumber++, version: 1,
          }).onConflictDoNothing({ target: exhibitions.id });
        } else {
          await tx.update(exhibitions).set({ title: item.title, description: item.description, curationData: document })
            .where(eq(exhibitions.id, item.id));
        }
        await tx.delete(exhibitionItems).where(eq(exhibitionItems.exhibitionId, item.id));
        await tx.insert(exhibitionItems).values(item.works.map((work, position) => ({
          id: `exi_${item.id}_${position}`, exhibitionId: item.id, workId: work.id, position, curatorNote: work.reason || null,
        })));
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
    return { works: SEED_WORKS.length, exhibitions: SEED_EXHIBITIONS.length + CURATION_DEMO_EXHIBITIONS.length + safeCurations.length, retired: retired.length };
  });
}
