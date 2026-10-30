import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Single SQLite database shared by the Next.js app and the MCP server process.
 * WAL mode + busy timeout lets both processes read/write the same file safely.
 */
let instance: DatabaseSync | null = null;

export function dbPath(): string {
  const p = process.env.LECTA_DB_PATH || "./data/lecta.db";
  return p === ":memory:" ? p : path.resolve(/*turbopackIgnore: true*/ process.cwd(), p);
}

export function openDb(file = dbPath()): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  const schema = fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "db", "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

export function getDb(): DatabaseSync {
  if (!instance) instance = openDb();
  return instance;
}

/** Tests inject an in-memory database. */
export function setDb(db: DatabaseSync | null) {
  instance = db;
}

export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export const nowIso = () => new Date().toISOString();

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
