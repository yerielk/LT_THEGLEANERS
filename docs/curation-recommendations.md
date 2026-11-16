# Curation recommendations

The manifest holds 30 hand-written editorial demo curations (`version: 2`). Each has a title, subtitle, pen-name curator, template, introduction, and for every work a one-line reason plus a longer note. They are demo writing by the team, not excerpts from blogs or user reviews; pull quotes are the curator's own sentences, not lines from the works.

- Source of truth: `scripts/data/editorial-curations.json`. Run `npx tsx scripts/build-curation-manifest.ts` to rebuild `src/lib/data/curation-manifest.json`. Work references are resolved from the built-in catalog or from `scripts/data/external-work-refs.json` (deployment-only works); an unknown reference fails the build.
- `npm run db:setup` reconciles editorial rows with the manifest on every run: title, introduction, template document, order and notes are rewritten, and `ex_blog_*` editorial rows that are no longer in the manifest are deleted (the previous 300 generated rows). Rows owned by people are never touched.
- 24 curations use only the 132 built-in works and seed on a fresh local database. Six more reference deployment-only works and are skipped where those works are missing; nothing is substituted.
- Seeded curations carry a `curationData` document, so they open in the magazine templates like user-made curations.

## Integration

- `/curations` is the canonical Curation page. `/curation` redirects there, preserving the query.
- Browse work and Curation tabs preserve their query. The v5 editor, its account-owned documents and the approved My rooms actions remain in place.
- `/api/curations` retains the onboarding branch's search GET and the template editor's creation POST. The new Curation UI uses `/api/exhibitions?q=...` for ranked search.
- Work selection recommendations call `/api/curation-recommendations`. A candidate must contain a selected work and relevant controlled tags. With no known query tag, selected-work tags supply the context.
- Base recommendation score: `0.60 * tagFit + 0.30 * tagCoverage + 0.10 * personalOverlap`. Optional embedding similarity contributes 15%, with the base reduced to 85%. Equal scores use the curation ID for stable order.
- Curation search combines known/nearby tags with literal title, included-work/creator and introduction/note matches. Unrelated candidates do not fill the result list.
- Discovery reads positive `SAVED`, `LIKED`, `CURATED` and `RECOMMENDATION_ADDED` signals, including the real onboarding survey. `DISLIKED` is excluded. With no positive profile it uses editorial defaults.
- Popular curations are randomized placeholders, not a ranking of likes or views.
- Shared public and owner-visible loads use batched queries so the 300 demos do not cause one query group per curation. Template document metadata remains present in bulk results.

## Optional embeddings

`LECTA_EMBEDDING_URL` is the full embedding endpoint (for example `http://127.0.0.1:11434/api/embed`). `LECTA_EMBEDDING_MODEL` selects the model. Requests use `{ model, input }` and responses `{ embeddings }`. A five-second timeout, network failure or malformed response falls back to tags. Real embedding-server connectivity is not claimed; tests mock that endpoint. There is no persistent vector index.

## Validation

Run `npm run typecheck`, `npm test -- --maxWorkers=1` and `npm run build -- --webpack`. Integration tests cover survey-to-discovery signals, unrelated/title/private search, bulk preservation of template data and safe reseeding of user drafts. Browser checks use a disposable local PostgreSQL database, never the deployment database.
