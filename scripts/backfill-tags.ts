/** Infers taste tags for works that have none (see src/lib/services/inferred-tags.ts). Safe to re-run. */
import { closeDb } from "../src/lib/db";
import { refreshInferredTags, untaggedWorkIds } from "../src/lib/services/inferred-tags";
import { loadEnv } from "./env";

loadEnv();
const ids = await untaggedWorkIds();
const tagged = await refreshInferredTags(ids);
console.log(`${ids.length} works without curated tags, ${tagged} now carry inferred tags`);
await closeDb();
