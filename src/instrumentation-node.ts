import { assertSafeConfig } from "./lib/deployment";

// A failing check exits, so a misconfigured container stops instead of idling.
try {
  assertSafeConfig();
} catch (e) {
  console.error(`[lecta] refusing to start: ${(e as Error).message}`);
  process.exit(1);
}
