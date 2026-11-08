import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { setDb, type Db } from "../src/lib/db";
import * as schema from "../src/lib/schema";
import { seedDatabase } from "../src/lib/data/seed";
import { DEMO_USER } from "../src/lib/data/catalog";
import type { Actor } from "../src/lib/services/actor";

/** In-memory PostgreSQL (PGlite) with the real migrations applied and the catalog seeded. */
export async function freshDb(): Promise<Db> {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  const db = pg as unknown as Db;
  await seedDatabase(db);
  setDb(db);
  return db;
}

/** Resolves to the LectaError code a call fails with, or "NO_ERROR". */
export async function code(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { return (e as { code: string }).code; }
  return "NO_ERROR";
}

export const demo: Actor = { userId: DEMO_USER.id, kind: "demo", label: "demo" };
export const stranger: Actor = { userId: "u_someone_else", kind: "demo", label: "stranger" };
export const anon: Actor = { userId: null, kind: "anonymous", label: "anonymous" };
