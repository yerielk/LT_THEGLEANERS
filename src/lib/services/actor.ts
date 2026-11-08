import { DEMO_USER } from "../data/catalog";
import { resolveApiKey } from "./api-keys";
import { isLocalDeployment } from "../deployment";

/** Who is acting: a signed-in user, the local demo user, an agent holding a personal MCP key, or nobody. */
export interface Actor {
  userId: string | null;
  kind: "user" | "demo" | "agent" | "anonymous";
  label: string;
}

export const ANONYMOUS: Actor = { userId: null, kind: "anonymous", label: "anonymous" };

// never on a deployment: it would let anyone write as the shared demo user
export const demoModeEnabled = () => process.env.DEMO_MODE === "true" && isLocalDeployment();

/** Local UAT fallback when nobody is signed in: writes go to the shared demo user. */
export const DEMO_ACTOR: Actor = { userId: DEMO_USER.id, kind: "demo", label: DEMO_USER.displayName };

/** MCP requests: `Authorization: Bearer <personal MCP key>` maps to that key's owner acting through an agent. */
export async function agentActorFromAuthHeader(header: string | null | undefined): Promise<Actor> {
  if (!header) return ANONYMOUS;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return ANONYMOUS;
  const owner = await resolveApiKey(m[1]);
  return owner ? { userId: owner.userId, kind: "agent", label: `agent (${owner.userName})` } : ANONYMOUS;
}
