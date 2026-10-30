import { openDb, setDb } from "../src/lib/db";
import { seedDatabase } from "../src/lib/data/seed";
import { DEMO_USER } from "../src/lib/data/catalog";
import type { Actor } from "../src/lib/services/actor";

export function freshDb() {
  const db = openDb(":memory:");
  seedDatabase(db);
  setDb(db);
  return db;
}

export const demo: Actor = { userId: DEMO_USER.id, kind: "demo", label: "demo" };
export const stranger: Actor = { userId: "u_someone_else", kind: "demo", label: "stranger" };
export const anon: Actor = { userId: null, kind: "anonymous", label: "anonymous" };
