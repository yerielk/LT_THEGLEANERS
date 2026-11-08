import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * PostgreSQL (Drizzle) shared by the Next.js app and the MCP server process.
 * Tests swap in an in-memory PGlite database with setDb().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

export const databaseUrl = () => process.env.DATABASE_URL || "postgres://lecta:lecta@127.0.0.1:5432/lecta";

// survive Next.js dev hot reloads without opening a new pool each time
const g = globalThis as { __lectaDb?: Db | null; __lectaPool?: Pool | null };

export function getDb(): Db {
  if (!g.__lectaDb) {
    g.__lectaPool = new Pool({ connectionString: databaseUrl(), max: 10 });
    g.__lectaDb = drizzle({ client: g.__lectaPool, schema });
  }
  return g.__lectaDb;
}

/** Tests inject an in-memory database. */
export function setDb(db: Db | null) {
  g.__lectaDb = db;
}

export async function closeDb() {
  await g.__lectaPool?.end();
  g.__lectaPool = null;
  g.__lectaDb = null;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
