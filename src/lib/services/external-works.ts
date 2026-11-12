/**
 * Saving a work found in an external catalog into ours.
 *
 * The client only names the work (source + id); the metadata always comes from the source itself, never
 * from the request. Sources whose terms forbid keeping metadata get an expiry, and refreshExpiredWorks()
 * refetches those by id.
 */
import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb, newId, type Db } from "../db";
import { works } from "../schema";
import { defaultProviders } from "../external/registry";
import { EXTERNAL_MEDIA, EXTERNAL_SOURCES, SOURCE_POLICY, externalWorkSchema, type ExternalProvider, type ExternalWork } from "../external/types";
import { zodMessage } from "../validators";
import type { Actor } from "./actor";
import { LectaError } from "./errors";
import { getWork, type WorkView } from "./works";

export const externalSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "q is required").max(80),
  medium: z.enum(EXTERNAL_MEDIA).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const saveExternalSchema = z.object({
  source: z.enum(EXTERNAL_SOURCES),
  externalId: z.string().trim().min(1).max(128),
  medium: z.enum(EXTERNAL_MEDIA),
  /** Needed only by sources that cannot look a work up by id alone (서울시 문화행사). */
  title: z.string().trim().max(200).optional(),
});

interface Deps {
  db?: Db;
  providers?: ExternalProvider[];
  now?: () => Date;
}

function columns(w: ExternalWork) {
  return {
    medium: w.medium,
    title: w.title,
    originalTitle: w.originalTitle,
    creator: w.creator,
    releaseYear: w.releaseYear,
    synopsis: w.synopsis,
    artworkUrl: w.artwork?.url ?? null,
    artworkSource: w.artwork?.credit ?? null,
    artworkLicenseNote: SOURCE_POLICY[w.source].attribution,
    sourceUrl: w.sourceUrl,
    license: w.license,
    metadataFetchedAt: new Date(w.fetchedAt),
    metadataExpiresAt: w.expiresAt ? new Date(w.expiresAt) : null,
    event: w.event ?? null,
    metadataStatus: "VERIFIED" as const,
  };
}

async function fetchFromSource(providers: ExternalProvider[], source: ExternalWork["source"], externalId: string, medium: ExternalWork["medium"], title?: string) {
  const provider = providers.find((p) => p.source === source);
  if (!provider) throw new LectaError("VALIDATION_ERROR", `${source} is not available`);
  const found = await provider.lookup(externalId, medium, { title });
  return found ? externalWorkSchema.parse(found) : null;
}

/** Drops the works that are already in our catalog: those show up in the catalog search itself. */
export async function withoutSaved(found: ExternalWork[], db: Db = getDb()): Promise<ExternalWork[]> {
  if (!found.length) return found;
  const rows = await db
    .select({ source: works.externalSource, externalId: works.externalId })
    .from(works)
    .where(inArray(works.externalId, found.map((w) => w.externalId)));
  const saved = new Set(rows.map((r) => `${r.source}:${r.externalId}`));
  return found.filter((w) => !saved.has(`${w.source}:${w.externalId}`));
}

/** Idempotent: saving a work that is already in the catalog refreshes its metadata and returns the same work. */
export async function saveExternalWork(input: unknown, actor: Actor, deps: Deps = {}): Promise<{ work: WorkView; created: boolean }> {
  if (!actor.userId) throw new LectaError("UNAUTHORIZED", "Saving a work requires signing in (or DEMO_MODE=true locally), or a personal MCP key.");
  const parsed = saveExternalSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const { source, externalId, medium, title } = parsed.data;
  const db = deps.db ?? getDb();

  const found = await fetchFromSource(deps.providers ?? defaultProviders(), source, externalId, medium, title);
  if (!found) throw new LectaError("WORK_NOT_FOUND", `${source} has no work with id "${externalId}"`);

  const same = and(eq(works.externalSource, source), eq(works.externalId, found.externalId));
  const [existing] = await db.select({ id: works.id }).from(works).where(same);
  if (existing) {
    await db.update(works).set({ ...columns(found), updatedAt: new Date() }).where(eq(works.id, existing.id));
    return { work: await getWork(existing.id, db), created: false };
  }
  const id = newId("w");
  // two people saving the same work at once: the second insert is dropped and both get the first row
  await db.insert(works).values({ id, externalSource: source, externalId: found.externalId, ...columns(found) }).onConflictDoNothing();
  const [row] = await db.select({ id: works.id }).from(works).where(same);
  return { work: await getWork(row.id, db), created: row.id === id };
}

/** Seeds the catalog with works already fetched from a source. Safe to repeat: existing works are refreshed. */
export async function importExternalWorks(found: ExternalWork[], db: Db = getDb()): Promise<{ created: number; updated: number }> {
  const out = { created: 0, updated: 0 };
  for (const raw of found) {
    const w = externalWorkSchema.parse(raw);
    const same = and(eq(works.externalSource, w.source), eq(works.externalId, w.externalId));
    const [existing] = await db.select({ id: works.id }).from(works).where(same);
    if (existing) {
      await db.update(works).set({ ...columns(w), updatedAt: new Date() }).where(eq(works.id, existing.id));
      out.updated++;
    } else {
      await db.insert(works).values({ id: newId("w"), externalSource: w.source, externalId: w.externalId, ...columns(w) });
      out.created++;
    }
  }
  return out;
}

/**
 * Refetches works whose cached metadata has expired, oldest first. Meant to be called by a scheduled job.
 * A work the source no longer answers for is left as it is and counted as failed.
 */
export async function refreshExpiredWorks(deps: Deps & { limit?: number } = {}): Promise<{ refreshed: number; failed: number }> {
  const db = deps.db ?? getDb();
  const now = (deps.now ?? (() => new Date()))();
  const due = await db
    .select()
    .from(works)
    .where(and(isNotNull(works.externalId), lte(works.metadataExpiresAt, now)))
    .orderBy(asc(works.metadataExpiresAt))
    .limit(deps.limit ?? 20);
  const out = { refreshed: 0, failed: 0 };
  for (const row of due) {
    const source = z.enum(EXTERNAL_SOURCES).safeParse(row.externalSource);
    try {
      const found = source.success ? await fetchFromSource(deps.providers ?? defaultProviders(), source.data, row.externalId!, row.medium, row.title) : null;
      if (!found) { out.failed++; continue; }
      await db.update(works).set({ ...columns(found), updatedAt: now }).where(eq(works.id, row.id));
      out.refreshed++;
    } catch {
      out.failed++;
    }
  }
  return out;
}
