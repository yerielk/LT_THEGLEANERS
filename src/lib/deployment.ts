/**
 * Local (dev / UAT on localhost) vs deployed (public URL). The public origin is BETTER_AUTH_URL, which a
 * deployment must set for Kakao login anyway, so it doubles as the switch for local-only conveniences.
 */
export function isLocalDeployment(): boolean {
  try {
    const host = new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Lecta user ids (users.id) allowed to open the agent lab on a deployment. */
export function adminUserIds(): string[] {
  return (process.env.LECTA_ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Refuses settings that are only safe on localhost. Called when the web server starts. */
export function assertSafeConfig() {
  if (isLocalDeployment()) return;
  if (process.env.DEMO_MODE === "true") {
    throw new Error("DEMO_MODE=true is only allowed when BETTER_AUTH_URL is localhost: it lets anyone write as the shared demo user.");
  }
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set (32+ characters) on a deployment.");
  }
}
