import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb, newId, type Db } from "../db";
import { apiKeys, user } from "../schema";
import { LectaError } from "./errors";
import type { Actor } from "./actor";

/** Personal MCP keys: `lk_` + 32 random bytes. Only the SHA-256 hash is stored; the key is shown once. */
const MAX_ACTIVE_KEYS = 5;

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function requireOwner(actor: Actor): string {
  // an agent must not be able to mint or revoke keys with the key it holds
  if (!actor.userId || actor.kind === "agent") throw new LectaError("UNAUTHORIZED", "Sign in to manage your MCP keys.");
  return actor.userId;
}

export async function listApiKeys(actor: Actor, db: Db = getDb()): Promise<ApiKeyView[]> {
  const userId = requireOwner(actor);
  const rows = await db.select().from(apiKeys).where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt))).orderBy(desc(apiKeys.createdAt));
  return rows.map((r) => ({ id: r.id, name: r.name, prefix: r.prefix, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt?.toISOString() ?? null }));
}

export async function createApiKey(actor: Actor, name: string, db: Db = getDb()): Promise<ApiKeyView & { key: string }> {
  const userId = requireOwner(actor);
  const label = name.trim().slice(0, 40);
  if (!label) throw new LectaError("VALIDATION_ERROR", "name: give the key a name");
  const [{ n }] = await db.select({ n: count() }).from(apiKeys).where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  if (n >= MAX_ACTIVE_KEYS) throw new LectaError("VALIDATION_ERROR", `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
  const key = `lk_${randomBytes(32).toString("base64url")}`;
  const row = { id: newId("key"), userId, name: label, prefix: key.slice(0, 10), keyHash: hash(key), createdAt: new Date() };
  await db.insert(apiKeys).values(row);
  return { id: row.id, name: row.name, prefix: row.prefix, createdAt: row.createdAt.toISOString(), lastUsedAt: null, key };
}

export async function revokeApiKey(actor: Actor, id: string, db: Db = getDb()): Promise<void> {
  const userId = requireOwner(actor);
  const done = await db.update(apiKeys).set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  if (!done.length) throw new LectaError("KEY_NOT_FOUND", "No active key with this id.");
}

/** Looks up an active key by its hash and records when it was last used. */
export async function resolveApiKey(key: string, db: Db = getDb()): Promise<{ userId: string; userName: string } | null> {
  if (!key.startsWith("lk_") || key.length > 100) return null;
  const [row] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, userName: user.name })
    .from(apiKeys)
    .innerJoin(user, eq(user.id, apiKeys.userId))
    .where(and(eq(apiKeys.keyHash, hash(key)), isNull(apiKeys.revokedAt)));
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return { userId: row.userId, userName: row.userName };
}
