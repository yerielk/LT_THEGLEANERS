/** Runs once when the Next.js server starts. A failing check exits, so a misconfigured container stops instead of idling. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertSafeConfig } = await import("./lib/deployment");
  try {
    assertSafeConfig();
  } catch (e) {
    console.error(`[lecta] refusing to start: ${(e as Error).message}`);
    process.exit(1);
  }
}
