# Curation templates and v5 service integration

The approved THE SPREAD, THE EDIT and AFTERIMAGE renderers and v5 editor live under `public/curation/`. The live app embeds these files rather than recreating their typography, palette rules or layout planner in React.

## User flow

- My rooms → Create a curation, or choose works in Browse works and open Curate.
- Write, Design, Preview and Focus use the approved v5 UI. Add a work searches the real internal catalog and external providers, not sample data. Work identity comes from the catalog; descriptions, reasons and layouts belong to the curation.
- Autosave and Save write a private account-owned draft to PostgreSQL. The address changes to its edit URL once created. View opens the persisted template; My rooms lists it. Existing and MCP-created drafts can be edited here too. Existing gallery views remain unchanged until saved through the new editor.
- Each curation keeps one document across all three templates: subtitle, curator, introduction, ordered catalog IDs, separate reason/body, scenes/captions/aspect ratios, layout, featured flag, palette and accent choice.
- Conflicting saves from another tab stop autosave and retain the current text in memory. Download JSON before reloading. A network failure shows an error and Save retries; unsaved changes trigger a browser leave warning. Service mode never reads/writes the prototype's shared localStorage draft.

## Persistence and APIs

Run `npm run db:setup` before starting the updated app. Migration `0002_curation_editor` adds `exhibitions.curation_data` and `curation_assets`. The existing deployment script already runs this command. The Docker web image now copies `public/` so the editor/templates are available in standalone deployments.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/curations` | Create an idempotent private draft, including empty drafts |
| `GET /api/curations/:id` | Read the normalized document/version under existing exhibition permissions |
| `PATCH /api/curations/:id` | Owner-only, version-checked document save; synchronizes exhibition items and CURATED taste signals |
| `POST /api/curations/:id/assets` | Owner-only raw image upload (8 MB maximum) |
| `GET /api/curation-assets/:id` | Serve an image under its parent curation's read permissions, without public caching |

Images are decoded and re-encoded to WebP with a maximum 1800px side and stored in PostgreSQL, so they survive redeployment without a separate storage account or disk mount. Uploads are limited to 200 per curation. SVG/executable uploads are refused; metadata is stripped by re-encoding. The approved palette engine's median-cut implementation is reused on a 72px server sample for uploads. Existing remote cover palettes are computed by the template when CORS permits (otherwise its deterministic fallback), then persisted with the document. No server fetches arbitrary remote image URLs.

The document allows 64 works, 12 scenes per work, 50,000 characters per body/introduction and a 1 MB total JSON request. Drafts remain private; this integration does not add a publishing/social workflow. Upload removal detaches a scene from the document; stored assets remain until the curation is deleted. A storage garbage-collection policy can be added if usage warrants it.

Template `postMessage` calls now require the same origin and the expected parent/opener. A ready handshake retries until React hydrates and provides the document. These are integration changes; template rendering, parser behavior, layout rhythm, palette guardrails and fonts are preserved. THE SPREAD's featured switch remains visually ineffective, as in v4; the editor explains this.

## Verification

- `npm run typecheck`
- `npm test -- --maxWorkers=1`
- `npm run build -- --webpack` (also checked with `NEXT_OUTPUT=standalone`)
- `LECTA_E2E_URL=http://localhost:3041 npm run test:curation-e2e` against a local/demo test server with a disposable database (requires the optional Playwright package and Chromium). Covers real catalog search, long writing, keyboard reorder, scene upload, three-template switching, server reload, the reader, My rooms and 390px layout. External search is stubbed for a deterministic browser test; the editor uses the real provider API in normal use.

`LECTA_DIST_DIR` can select an isolated Next.js output directory when a developer server is already running. Verification uses a separate temporary Postgres container and never a deployment database.
