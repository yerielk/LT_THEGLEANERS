import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { freshDb, code, anon, demo } from "./helpers";
import type { Db } from "../src/lib/db";
import { apiKeys } from "../src/lib/schema";
import { createApiKey, listApiKeys, revokeApiKey } from "../src/lib/services/api-keys";
import { agentActorFromAuthHeader } from "../src/lib/services/actor";

let db: Db;
beforeEach(async () => { db = await freshDb(); });

describe("personal MCP keys", () => {
  it("authenticates an agent as the key owner until the key is revoked", async () => {
    const k = await createApiKey(demo, "Claude Desktop", db);
    expect(k.key).toMatch(/^lk_/);
    const agent = await agentActorFromAuthHeader(`Bearer ${k.key}`);
    expect(agent).toMatchObject({ userId: demo.userId, kind: "agent" });

    await revokeApiKey(demo, k.id, db);
    expect((await agentActorFromAuthHeader(`Bearer ${k.key}`)).kind).toBe("anonymous");
    expect(await listApiKeys(demo, db)).toHaveLength(0);
  });

  it("stores only a hash, never the key itself", async () => {
    const k = await createApiKey(demo, "hash check", db);
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, k.id));
    expect(row.keyHash).not.toContain(k.key);
    expect(JSON.stringify(row)).not.toContain(k.key);
  });

  it("rejects unknown keys, anonymous callers and agents managing keys", async () => {
    expect((await agentActorFromAuthHeader("Bearer lk_not_a_real_key")).kind).toBe("anonymous");
    expect((await agentActorFromAuthHeader("Basic abc")).kind).toBe("anonymous");
    expect(await code(createApiKey(anon, "x", db))).toBe("UNAUTHORIZED");
    const k = await createApiKey(demo, "agent", db);
    const agent = await agentActorFromAuthHeader(`Bearer ${k.key}`);
    expect(await code(createApiKey(agent, "minted by an agent", db))).toBe("UNAUTHORIZED");
    expect(await code(revokeApiKey(agent, k.id, db))).toBe("UNAUTHORIZED");
  });

  it("limits active keys and only revokes your own", async () => {
    for (let i = 0; i < 5; i++) await createApiKey(demo, `k${i}`, db);
    expect(await code(createApiKey(demo, "sixth", db))).toBe("VALIDATION_ERROR");
    const [first] = await listApiKeys(demo, db);
    const other = { userId: "u_editorial", kind: "user" as const, label: "editorial" };
    expect(await code(revokeApiKey(other, first.id, db))).toBe("KEY_NOT_FOUND");
  });
});
