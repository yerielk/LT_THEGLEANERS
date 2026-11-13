# Blog-evidenced curation recommendations

## Evidence manifest

`src/lib/data/curation-manifest.json` is static application data, separate from PostgreSQL. It contains:

- `curations`: stable `ex_blog_*` ID, Korean title and introduction, exact work ID/title/medium/creator references, and one or more verified source records.
- Each source record: public page URL and title, the kind of editorial relationship, the work IDs actually grouped on that page, a strength from 0 to 1, and a short paraphrased rationale. Mere co-mention is not an accepted relationship kind.
- `tagEvidence`: a work reference, an existing controlled tag key, a weight, its public source and title, and a short rationale. TMDB-sourced works are rejected for source-based tag additions.

Do not store page bodies or source URLs in exhibition rows. Do not add an entry until the page itself and every work's title, medium and creator have been checked against the deployment catalog. The checked-in manifest is intentionally empty until that database and source review can happen.

## Ranking

The curation API scores all exhibitions the visitor is allowed to read, then returns up to six in descending score. The fixed score is:

`0.35 × mood-tag fit + 0.25 × tag cohesion + 0.20 × verified blog relation + 0.15 × semantic similarity + 0.05 × exact text fit`

- Mood-tag fit averages the strongest matched, existing tag weight per work. Query phrases are resolved only through the existing Korean/English tag dictionary. With no text query, already stored tags on selected non-TMDB works may supply the mood. TMDB works' tags are excluded.
- Tag cohesion is the mean weighted Jaccard overlap of tag sets across every pair of works in a curation. Works without tags contribute zero rather than being ignored; TMDB work tags are excluded.
- Blog relation combines independent source strengths as `1 - product(1 - strength)`, and counts only when at least two of the cited works remain in that curation.
- Semantic similarity is cosine similarity between the visitor's query and the editorial title/description. It is optional. Work metadata is not included in embedding requests, so TMDB content is excluded.
- Exact text fit is the fraction of normalized query words found in the title or introduction, with a full phrase match scoring 1.
- A selected-work inclusion adds 0.03 after the weighted score. It does not create a selected-first group.

Candidates need at least one query-related signal (mood tag, semantic match, exact text match, or selected work) to be returned. Ties use exhibition ID for a stable order. Public exhibitions and exhibitions owned by the current actor remain the only candidates.

Cards show up to three existing work artworks; `WorkImage` provides the project's typographic cover fallback. Recommendation reasons are generated from the matching tags, tag cohesion, verified blog evidence, text similarity, and selected-work inclusion. Internal scores are not shown as percentages.

## Validate and apply

The seed script checks every referenced work against the connected database's ID, title, medium and creator. It is additive: it inserts only missing public editorial exhibitions, unique work links and missing `HUMAN_CURATED` tags; it never updates or deletes existing rows. Dry-run runs inside a READ ONLY transaction. Apply requires both the deployment Compose database host and an explicit deployment marker.

Run these from the deployment server, through the `mcp` Compose service:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm mcp npm run curations:seed -- --dry-run
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm -e LECTA_CURATION_SEED_TARGET=deployment mcp npm run curations:seed -- --apply
```

Review the dry-run match failures and proposed counts before running apply. The deployment target is `postgres:5432/lecta`, which resolves inside the Compose network. The script refuses localhost, non-Compose hosts and apply without the explicit marker. No curation or tag records are applied by the current empty manifest.
