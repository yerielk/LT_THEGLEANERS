import fs from "node:fs";
import path from "node:path";
import { eq, inArray, max, sql } from "drizzle-orm";
import { closeDb, databaseUrl, getDb } from "../src/lib/db";
import { exhibitionItems, exhibitions, user, works, workTags } from "../src/lib/schema";
import { TAG_BY_KEY, normalize } from "../src/lib/recommendation/tags";
import { curationManifestSchema, type CurationManifest } from "../src/lib/data/curation-manifest";
import { loadEnv } from "./env";

type Mode = "dry-run" | "apply";
const args = new Set(process.argv.slice(2));
if (args.has("--dry-run") === args.has("--apply")) {
  console.error("Choose exactly one mode: --dry-run or --apply.");
  process.exit(2);
}
const mode: Mode = args.has("--apply") ? "apply" : "dry-run";
const manifestArg = process.argv.indexOf("--manifest");
const manifestPath = path.resolve(manifestArg >= 0 ? process.argv[manifestArg + 1] ?? "" : "src/lib/data/curation-manifest.json");

loadEnv();
const rawUrl = databaseUrl();
let target: { host: string; port: string; database: string };
try {
  const url = new URL(rawUrl);
  target = { host: url.hostname.replace(/^\[|\]$/g, ""), port: url.port || "5432", database: decodeURIComponent(url.pathname.replace(/^\//, "")) };
} catch {
  console.error("DATABASE_URL is malformed; no database connection was attempted.");
  process.exit(2);
}

// The production Compose network exposes PostgreSQL to the mcp service as `postgres`.
// Refuse localhost and arbitrary remote hosts before opening a connection.
if (!fs.existsSync("/.dockerenv") || target.host !== "postgres" || target.database !== "lecta") {
  console.error("Refusing to connect: run this command inside the deployment mcp container (postgres:5432/lecta).");
  process.exit(2);
}
if (mode === "apply" && process.env.LECTA_CURATION_SEED_TARGET !== "deployment") {
  console.error("Apply mode requires LECTA_CURATION_SEED_TARGET=deployment.");
  process.exit(2);
}

let manifest: CurationManifest;
try {
  manifest = curationManifestSchema.parse(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
} catch (error) {
  const detail = error instanceof Error && "issues" in error
    ? JSON.stringify((error as { issues: unknown }).issues)
    : "invalid JSON or unreadable manifest";
  console.error(`Manifest validation failed: ${detail}`);
  process.exit(2);
}

const unique = <T,>(values: T[]) => [...new Set(values)];
const sameText = (a: string | null | undefined, b: string) => normalize(a ?? "") === normalize(b);

interface Summary {
  mode: Mode;
  target: typeof target;
  curationsToCreate: number;
  curationsAlreadySeeded: number;
  curationsSkipped: number;
  workLinksToAdd: number;
  tagRowsToAdd: number;
  tagRowsAlreadyPresent: number;
  matchingFailures: string[];
}

const db = getDb();
try {
  const summary = await db.transaction(async (tx): Promise<Summary> => {
    if (mode === "dry-run") await tx.execute(sql`SET TRANSACTION READ ONLY`);

    const refs = [
      ...manifest.curations.flatMap((item) => item.works),
      ...manifest.tagEvidence.map((item) => item.work),
    ];
    const refsById = new Map<string, CurationManifest["curations"][number]["works"]>();
    for (const ref of refs) refsById.set(ref.id, [...(refsById.get(ref.id) ?? []), ref]);
    const ids = [...refsById.keys()];
    const dbWorks = ids.length ? await tx.select({
      id: works.id, title: works.title, medium: works.medium, creator: works.creator, externalSource: works.externalSource,
    }).from(works).where(inArray(works.id, ids)) : [];
    const worksById = new Map(dbWorks.map((item) => [item.id, item]));
    const failures: string[] = [];
    const verified = new Set<string>();
    for (const [id, workRefs] of refsById) {
      const found = worksById.get(id);
      if (!found) { failures.push(`missing work: ${id} (${workRefs[0].title})`); continue; }
      if (workRefs.some((ref) => found.medium !== ref.medium || !sameText(found.title, ref.title) || !sameText(found.creator, ref.creator))) {
        failures.push(`work metadata mismatch: ${id}`);
        continue;
      }
      verified.add(id);
    }

    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, "u_editorial"));
    if (!owner && manifest.curations.length) failures.push("editorial seed owner u_editorial is missing");

    const curationIds = manifest.curations.map((item) => item.id);
    const existingRows = curationIds.length ? await tx.select({
      id: exhibitions.id, ownerId: exhibitions.ownerId, title: exhibitions.title, description: exhibitions.description,
      visibility: exhibitions.visibility, isEditorial: exhibitions.isEditorial, slug: exhibitions.slug,
    }).from(exhibitions).where(inArray(exhibitions.id, curationIds)) : [];
    const existingById = new Map(existingRows.map((item) => [item.id, item]));
    const expectedSlugs = manifest.curations.map((item) => item.id.replace(/^ex_/, "").replace(/_/g, "-"));
    const slugsInUse = expectedSlugs.length ? await tx.select({ id: exhibitions.id, slug: exhibitions.slug })
      .from(exhibitions).where(inArray(exhibitions.slug, expectedSlugs)) : [];
    const slugOwner = new Map(slugsInUse.map((item) => [item.slug, item.id]));
    const existingItemRows = curationIds.length ? await tx.select({ exhibitionId: exhibitionItems.exhibitionId, workId: exhibitionItems.workId })
      .from(exhibitionItems).where(inArray(exhibitionItems.exhibitionId, curationIds)) : [];
    const itemsByCuration = new Map<string, Set<string>>();
    for (const item of existingItemRows) {
      const set = itemsByCuration.get(item.exhibitionId) ?? new Set<string>();
      set.add(item.workId);
      itemsByCuration.set(item.exhibitionId, set);
    }

    const usableCurations = manifest.curations.filter((item) => {
      const invalidWork = item.works.some((ref) => !verified.has(ref.id));
      const existing = existingById.get(item.id);
      const slug = item.id.replace(/^ex_/, "").replace(/_/g, "-");
      const occupiedSlug = slugOwner.get(slug);
      const itemSet = itemsByCuration.get(item.id) ?? new Set<string>();
      const expected = new Set(item.works.map((work) => work.id));
      const hasForeignItem = [...itemSet].some((id) => !expected.has(id));
      const identityConflict = existing && (existing.ownerId !== "u_editorial" || !existing.isEditorial ||
        existing.visibility !== "PUBLIC" || existing.title !== item.title || existing.description !== item.description);
      const slugConflict = occupiedSlug && occupiedSlug !== item.id;
      if (invalidWork || identityConflict || hasForeignItem || slugConflict || (!owner && manifest.curations.length)) {
        failures.push(`curation skipped: ${item.id}${invalidWork ? " (unmatched work)" : identityConflict ? " (existing row differs or is not editorial)" : hasForeignItem ? " (unexpected existing work link)" : slugConflict ? " (slug already in use)" : " (owner missing)"}`);
        return false;
      }
      return true;
    });

    const tagWorkIds = unique(manifest.tagEvidence.map((item) => item.work.id).filter((id) => verified.has(id)));
    const existingTags = tagWorkIds.length ? await tx.select({ workId: workTags.workId, tagKey: workTags.tagKey })
      .from(workTags).where(inArray(workTags.workId, tagWorkIds)) : [];
    const tagSet = new Set(existingTags.map((item) => `${item.workId}\n${item.tagKey}`));
    const usableTags = manifest.tagEvidence.filter((item) => {
      if (!verified.has(item.work.id)) return false;
      if (!TAG_BY_KEY[item.tagKey]) { failures.push(`unknown tag key: ${item.tagKey}`); return false; }
      if (worksById.get(item.work.id)?.externalSource === "TMDB") {
        failures.push(`TMDB-derived work cannot receive source-based tag evidence: ${item.work.id}`);
        return false;
      }
      return true;
    });
    const tagsToAdd = usableTags.filter((item) => !tagSet.has(`${item.work.id}\n${item.tagKey}`));
    const tagsAlreadyPresent = usableTags.length - tagsToAdd.length;
    const linksToAdd = usableCurations.reduce((sum, item) => {
      const existing = itemsByCuration.get(item.id) ?? new Set<string>();
      return sum + item.works.filter((work) => !existing.has(work.id)).length;
    }, 0);

    if (mode === "apply") {
      const [{ currentMax }] = await tx.select({ currentMax: max(exhibitions.number) }).from(exhibitions);
      let nextNumber = (currentMax ?? 0) + 1;
      for (const item of usableCurations) {
        const existing = existingById.get(item.id);
        if (!existing) {
          await tx.insert(exhibitions).values({
            id: item.id, ownerId: "u_editorial", slug: item.id.replace(/^ex_/, "").replace(/_/g, "-"),
            title: item.title, description: item.description, visibility: "PUBLIC", isEditorial: true, number: nextNumber++, version: 1,
          }).onConflictDoNothing();
        }
        const existingItems = itemsByCuration.get(item.id) ?? new Set<string>();
        const missingWorks = item.works.filter((work) => !existingItems.has(work.id));
        if (missingWorks.length) await tx.insert(exhibitionItems).values(missingWorks.map((work) => ({
          id: `exi_${item.id}_${item.works.findIndex((ref) => ref.id === work.id)}`,
          exhibitionId: item.id, workId: work.id, position: item.works.findIndex((ref) => ref.id === work.id), curatorNote: null,
        }))).onConflictDoNothing();
      }
      if (tagsToAdd.length) await tx.insert(workTags).values(tagsToAdd.map((item) => ({
        id: `t_${item.work.id}_${item.tagKey}`,
        workId: item.work.id,
        tagKey: item.tagKey,
        category: TAG_BY_KEY[item.tagKey].category,
        weight: item.weight,
        provenance: "HUMAN_CURATED" as const,
        evidenceText: item.rationale,
        reviewed: true,
      }))).onConflictDoNothing();
    }

    return {
      mode, target, curationsToCreate: usableCurations.filter((item) => !existingById.has(item.id)).length,
      curationsAlreadySeeded: usableCurations.filter((item) => existingById.has(item.id)).length,
      curationsSkipped: manifest.curations.length - usableCurations.length,
      workLinksToAdd: linksToAdd, tagRowsToAdd: tagsToAdd.length, tagRowsAlreadyPresent: tagsAlreadyPresent,
      matchingFailures: failures,
    };
  });
  console.log(JSON.stringify(summary, null, 2));
} catch {
  console.error("Curation seed failed; the transaction was rolled back. Database details were omitted.");
  process.exitCode = 1;
} finally {
  await closeDb();
}
