/**
 * Builds src/lib/data/curation-manifest.json from scripts/data/editorial-curations.json.
 * Work references are resolved from the built-in catalog or, for deployment-only works,
 * from the reference pool in scripts/data/external-work-refs.json. Nothing is invented:
 * an unknown reference fails the build.
 */
import fs from "node:fs";
import path from "node:path";
import { SEED_WORKS } from "../src/lib/data/catalog";
import { curationManifestSchema } from "../src/lib/data/curation-manifest";

type Ref = { id: string; title: string; medium: string; creator: string };
type Source = { id: string; title: string; subtitle: string; curator: string; template: string; intro: string; works: [string, string, string][] };

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const source: Source[] = read("scripts/data/editorial-curations.json");
const pool: Ref[] = read("scripts/data/external-work-refs.json");
const manifestPath = "src/lib/data/curation-manifest.json";
const previous = read(manifestPath);

const byId = new Map<string, Ref>();
for (const ref of pool) byId.set(ref.id, ref);
for (const work of SEED_WORKS) byId.set(work.id, { id: work.id, title: work.title, medium: work.medium, creator: work.creator });

function resolve(key: string): Ref {
  if (key.startsWith("title:")) {
    const title = key.slice(6);
    const hits = pool.filter((ref) => ref.title === title);
    if (hits.length !== 1) throw new Error(`"${title}" matches ${hits.length} pooled works`);
    return hits[0];
  }
  const ref = byId.get(key);
  if (!ref) throw new Error(`unknown work ${key}`);
  return ref;
}

const curations = source.map((entry) => ({
  id: entry.id, title: entry.title, subtitle: entry.subtitle, curator: entry.curator, template: entry.template, description: entry.intro,
  works: entry.works.map(([key, reason, note]) => ({ ...resolve(key), reason, note })),
}));
const manifest = curationManifestSchema.parse({ version: 2, curations, tagEvidence: previous.tagEvidence });
fs.writeFileSync(path.join(root, manifestPath), JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${manifest.curations.length} curations, ${manifest.curations.reduce((n, c) => n + c.works.length, 0)} work links`);
