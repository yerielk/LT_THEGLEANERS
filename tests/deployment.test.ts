import { describe, it, expect, afterEach } from "vitest";
import { assertSafeConfig, isLocalDeployment } from "../src/lib/deployment";
import { demoModeEnabled } from "../src/lib/services/actor";
import { canUseAgentLab } from "../src/lib/services/web-actor";
import { clientIp, hit, resetRateLimits } from "../src/lib/rate-limit";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; resetRateLimits(); });

const deployed = (extra: Record<string, string> = {}) =>
  Object.assign(process.env, { BETTER_AUTH_URL: "https://lecta.example.com", BETTER_AUTH_SECRET: "x".repeat(32), ...extra });

describe("deployment guards", () => {
  it("treats localhost as local and a public URL as deployed", () => {
    delete process.env.BETTER_AUTH_URL;
    expect(isLocalDeployment()).toBe(true);
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    expect(isLocalDeployment()).toBe(true);
    deployed();
    expect(isLocalDeployment()).toBe(false);
  });

  it("refuses DEMO_MODE and a missing secret on a deployment, and ignores DEMO_MODE there", () => {
    deployed({ DEMO_MODE: "true" });
    expect(() => assertSafeConfig()).toThrow(/DEMO_MODE/);
    expect(demoModeEnabled()).toBe(false);
    deployed({ DEMO_MODE: "false", BETTER_AUTH_SECRET: "short" });
    expect(() => assertSafeConfig()).toThrow(/BETTER_AUTH_SECRET/);
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.DEMO_MODE = "true";
    expect(() => assertSafeConfig()).not.toThrow();
    expect(demoModeEnabled()).toBe(true);
  });

  it("opens the agent lab locally, and only to listed admins on a deployment", () => {
    const user = { userId: "u_admin", kind: "user" as const, label: "admin" };
    const anon = { userId: null, kind: "anonymous" as const, label: "anonymous" };
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    expect(canUseAgentLab(anon)).toBe(true);
    deployed({ LECTA_ADMIN_USER_IDS: "u_admin, u_other" });
    expect(canUseAgentLab(user)).toBe(true);
    expect(canUseAgentLab({ ...user, userId: "u_someone" })).toBe(false);
    expect(canUseAgentLab(anon)).toBe(false);
    expect(canUseAgentLab({ ...user, kind: "agent" })).toBe(false);
  });
});

describe("rate limit", () => {
  it("allows the limit within a window, then blocks until it resets", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(hit("k", 3, 60_000, t).ok).toBe(true);
    const blocked = hit("k", 3, 60_000, t + 1_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
    expect(hit("k", 3, 60_000, t + 60_000).ok).toBe(true);
    expect(hit("other", 3, 60_000, t).ok).toBe(true);
  });

  it("keys on the entry our proxy appended, not a client-supplied one", () => {
    expect(clientIp("6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp(null, "10.0.0.1")).toBe("10.0.0.1");
    expect(clientIp(undefined)).toBe("local");
  });
});
