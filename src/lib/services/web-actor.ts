import { headers } from "next/headers";
import { auth } from "../auth";
import { ANONYMOUS, DEMO_ACTOR, demoModeEnabled, type Actor } from "./actor";
import { adminUserIds, isLocalDeployment } from "../deployment";

/** Web requests: the signed-in user; otherwise the demo user when DEMO_MODE=true (local UAT); otherwise read-only. */
export async function webActor(): Promise<Actor> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (s) return { userId: s.user.id, kind: "user", label: s.user.name };
  return demoModeEnabled() ? DEMO_ACTOR : ANONYMOUS;
}

/** The agent lab shows every agent call (with user names), so on a deployment only admins may open it. */
export function canUseAgentLab(actor: Actor): boolean {
  return isLocalDeployment() || (actor.kind === "user" && !!actor.userId && adminUserIds().includes(actor.userId));
}
