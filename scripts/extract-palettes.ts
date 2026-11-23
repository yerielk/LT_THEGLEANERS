/**
 * Samples artwork colours for works that have none, so curation covers can take their colour from the works.
 * Safe to re-run; `npm run palettes:extract -- 200` limits how many works one run touches.
 */
import { and, isNotNull, isNull, eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/lib/db";
import { works } from "../src/lib/schema";
import { paletteFromUrl } from "../src/lib/curation/sample-palette";
import { loadEnv } from "./env";

loadEnv();
const limit = Math.max(1, Number(process.argv[2]) || 2000);
const db = getDb();
const rows = await db.select({ id: works.id, url: works.artworkUrl, title: works.title }).from(works).where(and(isNotNull(works.artworkUrl), isNull(works.palette))).limit(limit);
let done = 0, failed = 0;
for (const row of rows) {
  const palette = await paletteFromUrl(row.url!);
  if (palette) { await db.update(works).set({ palette }).where(eq(works.id, row.id)); done++; }
  else { failed++; console.log(`no colours: ${row.title}`); }
  // be a polite guest on the image hosts
  await new Promise((r) => setTimeout(r, 150));
}
console.log(`${rows.length} works without colours, ${done} sampled, ${failed} could not be read`);
await closeDb();
