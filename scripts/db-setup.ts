import { count } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { closeDb, databaseUrl, getDb } from "../src/lib/db";
import { seedDatabase } from "../src/lib/data/seed";
import { exhibitions, works, workTags } from "../src/lib/schema";
import { loadEnv } from "./env";

// Applies the migrations in ./drizzle, then seeds (both safe to re-run).
loadEnv();
const url = new URL(databaseUrl());
const db = getDb();
await migrate(db as unknown as NodePgDatabase, { migrationsFolder: "drizzle" });
const res = await seedDatabase(db);
const [[w], [t], [e]] = await Promise.all([
  db.select({ n: count() }).from(works),
  db.select({ n: count() }).from(workTags),
  db.select({ n: count() }).from(exhibitions),
]);
console.log(`[db:setup] postgres://${url.hostname}:${url.port || 5432}${url.pathname}`);
console.log(`[db:setup] seeded ${res.works} catalog works, ${res.exhibitions} editorial exhibitions`);
console.log(`[db:setup] totals`, { works: w.n, tags: t.n, exhibitions: e.n });
await closeDb();
