import type { DatabaseSync } from "node:sqlite";
import { tx, nowIso } from "../db";
import { SEED_WORKS, SEED_EXHIBITIONS, EDITORIAL_USER, DEMO_USER } from "./catalog";
import { TAG_BY_KEY } from "../recommendation/tags";
import { ARTWORK } from "./artwork";

/**
 * Idempotent seed: upserts catalog works + tags, the two system users and the editorial sample exhibitions.
 * User-created drafts are never touched, so it is safe to re-run.
 */
export function seedDatabase(db: DatabaseSync) {
  const now = nowIso();
  return tx(db, () => {
    const upUser = db.prepare(
      "INSERT INTO users (id, handle, display_name, demo_flag, is_editorial, created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name",
    );
    upUser.run(EDITORIAL_USER.id, EDITORIAL_USER.handle, EDITORIAL_USER.displayName, 0, 1, now);
    upUser.run(DEMO_USER.id, DEMO_USER.handle, DEMO_USER.displayName, 1, 0, now);

    const upWork = db.prepare(`INSERT INTO works (id, medium, title, original_title, creator, release_year, synopsis, artwork_url, artwork_source, artwork_license_note, source_url, external_source, metadata_status, cover_tone, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, 'Lecta editorial', 'CURATED', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET medium=excluded.medium, title=excluded.title, original_title=excluded.original_title, creator=excluded.creator,
        release_year=excluded.release_year, synopsis=excluded.synopsis, artwork_url=excluded.artwork_url, artwork_source=excluded.artwork_source,
        artwork_license_note=excluded.artwork_license_note, source_url=excluded.source_url, cover_tone=excluded.cover_tone, updated_at=excluded.updated_at`);
    const delTags = db.prepare("DELETE FROM work_tags WHERE work_id = ? AND provenance = 'HUMAN_CURATED'");
    const insTag = db.prepare(
      "INSERT INTO work_tags (id, work_id, tag_key, category, weight, provenance, evidence_text, reviewed) VALUES (?,?,?,?,?, 'HUMAN_CURATED', 'curated interpretation', 1)",
    );
    for (const w of SEED_WORKS) {
      const art = ARTWORK[w.id];
      upWork.run(
        w.id, w.medium, w.title, w.originalTitle ?? null, w.creator, w.year, w.synopsis,
        art?.url ?? null, art ? "Wikipedia infobox (Wikimedia)" : null,
        art ? "Official artwork © its rights holder, shown for identification; hot-linked from Wikimedia." : null,
        art?.sourcePage ?? null, w.tone, now, now,
      );
      delTags.run(w.id);
      for (const pair of w.tags.split(",")) {
        const [key, weight] = pair.split(":");
        const def = TAG_BY_KEY[key];
        if (!def) throw new Error(`Unknown tag "${key}" on ${w.id}`);
        insTag.run(`t_${w.id}_${key}`, w.id, key, def.category, Number(weight));
      }
    }

    for (const ex of SEED_EXHIBITIONS) {
      db.prepare(`INSERT INTO exhibitions (id, owner_id, slug, title, description, visibility, layout_template, is_editorial, number, version, created_at, updated_at)
        VALUES (?,?,?,?,?, 'PUBLIC', 'EDITORIAL_01', 1, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, number=excluded.number`).run(
        ex.id, EDITORIAL_USER.id, ex.id.replace(/^ex_/, "").replace(/_/g, "-"), ex.title, ex.description, ex.number, now, now,
      );
      db.prepare("DELETE FROM exhibition_items WHERE exhibition_id = ?").run(ex.id);
      const ins = db.prepare("INSERT INTO exhibition_items (id, exhibition_id, work_id, position, curator_note) VALUES (?,?,?,?,?)");
      ex.items.forEach((it, i) => ins.run(`exi_${ex.id}_${i}`, ex.id, it.workId, i, it.note ?? null));
    }
    // user-created exhibitions are numbered after the editorial samples
    return { works: SEED_WORKS.length, exhibitions: SEED_EXHIBITIONS.length };
  });
}
