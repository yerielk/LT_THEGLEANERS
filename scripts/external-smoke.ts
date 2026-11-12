/**
 * Calls every external provider once with the real keys and prints what came back (never the keys).
 *
 *   npm run external:smoke                 # reads ./.env
 *   npm run external:smoke -- ../../.env   # or another env file
 *
 * It also measures three things the KOPIS docs leave open: how wide a date window the list accepts,
 * how far back it goes, and whether posters are served over https.
 */
import path from "node:path";
import { loadEnv } from "./env";
import { createTmdb } from "../src/lib/external/tmdb";
import { createKakaoBook } from "../src/lib/external/kakao-book";
import { createKopis } from "../src/lib/external/kopis";
import { createSeoulCulture } from "../src/lib/external/seoul-culture";
import { createMusicBrainz } from "../src/lib/external/musicbrainz";
import { externalWorkSchema, type ExternalMedium, type ExternalProvider, type ExternalWork } from "../src/lib/external/types";

loadEnv(process.argv[2] ? path.resolve(process.argv[2]) : undefined);

let failed = 0;
const line = (w: ExternalWork) =>
  `    ${w.medium.padEnd(11)} ${w.title} | ${w.creator || "-"} | ${w.releaseYear ?? "-"} | ${w.externalId}${w.event ? ` | ${w.event.venue ?? "-"} ${w.event.startDate ?? ""}` : ""}${w.artwork ? "" : " | no image"}`;

async function check(label: string, run: () => Promise<ExternalWork[]>) {
  try {
    const works = await run();
    for (const w of works) externalWorkSchema.parse(w);
    console.log(`ok   ${label}: ${works.length} result(s)`);
    works.slice(0, 3).forEach((w) => console.log(line(w)));
    return works;
  } catch (e) {
    failed++;
    console.log(`FAIL ${label}: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function provider(p: ExternalProvider, q: string, medium?: ExternalMedium) {
  const found = await check(`${p.source} search "${q}"`, () => p.search({ q, medium, limit: 5 }));
  if (found[0]) await check(`${p.source} lookup ${found[0].externalId}`, async () => {
    const one = await p.lookup(found[0].externalId, found[0].medium);
    return one ? [one] : [];
  });
  return found;
}

await provider(createTmdb(), "기생충");
await provider(createKakaoBook(), "소년이 온다");
await provider(createMusicBrainz(), "꽃갈피", "ALBUM");
await provider(createSeoulCulture(), "전시", "EXHIBITION");
const runs = await provider(createKopis(), "레미제라블");

console.log("\nKOPIS measurements");
for (const [label, daysBack, daysAhead] of [["31 days", 31, 0], ["6 months", 183, 0], ["3 years", 1095, 0], ["10 years", 3650, 0]] as const) {
  await check(`  window of ${label}`, () => createKopis({ daysBack, daysAhead }).search({ q: "레미제라블", limit: 100 }));
}
const poster = runs.find((w) => w.artwork)?.artwork?.url;
if (poster) {
  for (const url of [poster, poster.replace(/^http:/, "https:")]) {
    const res = await fetch(url, { method: "HEAD" }).catch(() => null);
    console.log(`  poster over ${new URL(url).protocol} ${res ? `${res.status} ${res.headers.get("content-type") ?? ""}` : "no answer"}`);
  }
}

process.exit(failed ? 1 : 0);
