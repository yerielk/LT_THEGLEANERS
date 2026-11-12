/**
 * Seeds the catalog with each source's best-known works. Safe to re-run: works already there are refreshed.
 *
 *   npm run catalog:import                         # 1000 films, 1000 albums, 1000 exhibitions into DATABASE_URL
 *   npm run catalog:import -- --films 200 --albums 0 --exhibitions 50
 *   npm run catalog:import -- --env ../../.env     # read keys from another env file
 *   npm run catalog:import -- --films 0 --albums 0 --exhibitions 0 --books scripts/popular-books.tsv --books-max 1000
 *
 * Films come from TMDB (most votes), albums from ListenBrainz (most listens) and exhibitions from 서울시 문화행사
 * (as listed; it has no ranking). No source we hold a key for can list well-known books, so books come from a
 * file of `title<TAB>author` lines (gathered from public reading lists, best-known lists first) and each one is
 * looked up on Kakao, in order, until --books-max books are found.
 */
import fs from "node:fs";
import path from "node:path";
import { closeDb, databaseUrl, getDb } from "../src/lib/db";
import { createKakaoBook, pickBook } from "../src/lib/external/kakao-book";
import { createMusicBrainz } from "../src/lib/external/musicbrainz";
import { createSeoulCulture } from "../src/lib/external/seoul-culture";
import { createTmdb } from "../src/lib/external/tmdb";
import type { ExternalProvider, ExternalWork } from "../src/lib/external/types";
import { importExternalWorks } from "../src/lib/services/external-works";
import { loadEnv } from "./env";

const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
const count = (name: string) => { const n = Number(arg(name) ?? 1000); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1000; };
loadEnv(arg("env") ? path.resolve(arg("env")!) : undefined);

const url = new URL(databaseUrl());
console.log(`[catalog:import] postgres://${url.hostname}:${url.port || 5432}${url.pathname}`);

const jobs: [string, ExternalProvider, number][] = [
  ["films", createTmdb(), count("films")],
  ["albums", createMusicBrainz(), count("albums")],
  ["exhibitions", createSeoulCulture(), count("exhibitions")],
];
let failed = 0;
for (const [label, provider, want] of jobs) {
  if (!want) continue;
  const started = Date.now();
  try {
    const found = await provider.popular!(want);
    const { created, updated } = await importExternalWorks(found, getDb());
    console.log(`[catalog:import] ${label}: ${found.length} fetched, ${created} new, ${updated} refreshed (${Math.round((Date.now() - started) / 1000)}s)`);
  } catch (e) {
    failed++;
    console.log(`[catalog:import] ${label}: FAILED, ${e instanceof Error ? e.message : String(e)}`);
  }
}
const booksFile = arg("books");
if (booksFile) {
  const started = Date.now();
  const kakao = createKakaoBook();
  const wanted = fs.readFileSync(path.resolve(booksFile), "utf8").split(/\r?\n/).map((l) => l.split("\t")).filter((c) => c[0]?.trim());
  const found = new Map<string, ExternalWork>();
  const missed: string[] = [];
  const max = Number(arg("books-max")) || Infinity;
  let tried = 0;
  try {
    for (const [title, author = ""] of wanted) {
      if (found.size >= max) break;
      tried++;
      // with the author first; some lists spell names in ways Kakao does not match, so the title alone is the fallback
      const hit =
        pickBook(title, author, await kakao.search({ q: `${title} ${author}`.trim(), medium: "BOOK", limit: 10 })) ??
        (author ? pickBook(title, author, await kakao.search({ q: title, medium: "BOOK", limit: 20 })) : null);
      if (hit) found.set(hit.externalId, hit);
      else missed.push(`${title} / ${author}`);
    }
    const { created, updated } = await importExternalWorks([...found.values()], getDb());
    console.log(`[catalog:import] books: ${tried} of ${wanted.length} listed tried, ${found.size} found, ${created} new, ${updated} refreshed (${Math.round((Date.now() - started) / 1000)}s)`);
    if (missed.length) console.log(`[catalog:import] books not found on Kakao (${missed.length}):\n  ${missed.join("\n  ")}`);
  } catch (e) {
    failed++;
    console.log(`[catalog:import] books: FAILED, ${e instanceof Error ? e.message : String(e)}`);
  }
}
await closeDb();
process.exit(failed ? 1 : 0);
