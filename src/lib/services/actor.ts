import { DEMO_USER } from "../data/catalog";

/** Who is acting. There are no real accounts yet: writes run as the fixed demo actor, and only when allowed. */
export interface Actor {
  userId: string | null;
  kind: "demo" | "agent" | "anonymous";
  label: string;
}

export const ANONYMOUS: Actor = { userId: null, kind: "anonymous", label: "anonymous" };

export const demoModeEnabled = () => process.env.DEMO_MODE === "true";

/** Web requests act as the demo user only when DEMO_MODE=true (local UAT). Otherwise read-only. */
export function webActor(): Actor {
  return demoModeEnabled() ? { userId: DEMO_USER.id, kind: "demo", label: DEMO_USER.displayName } : ANONYMOUS;
}

/** MCP requests: a valid `Authorization: Bearer <LECTA_MCP_WRITE_KEY>` maps to the demo user acting through an agent. */
export function agentActorFromAuthHeader(header: string | null | undefined): Actor {
  const key = process.env.LECTA_MCP_WRITE_KEY;
  if (!key || !demoModeEnabled() || !header) return ANONYMOUS;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return ANONYMOUS;
  // constant-time-ish compare
  const a = Buffer.from(m[1]);
  const b = Buffer.from(key);
  if (a.length !== b.length) return ANONYMOUS;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 ? { userId: DEMO_USER.id, kind: "agent", label: "agent (demo user)" } : ANONYMOUS;
}
