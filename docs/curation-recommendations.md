# Curation recommendations

The manifest contains 300 synthetic editorial demo curations built from real catalog work IDs. They are demo data, not verified blog excerpts or user-authored reviews. `npm run db:setup` applies migrations and seeds these records through the existing deployment script; it preserves user-owned drafts. The separate `curation-source-research.md` is reference research, not provenance for every manifest row.

Many references use external-work IDs from the deployment catalog, not the 132 built-in work IDs. A fresh 132-work local database only matches 11 manifest curations (19 editorial rows including the eight built-in demos). Missing/mismatched works cause that whole manifest curation to be skipped; the seed does not invent works or silently attach different IDs. The actual deployment seed count must be read from its logs.

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
