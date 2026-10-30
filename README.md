# Lecta — THE GLEANERS

> **Lecta is a living exhibition of the things you love, and why.**

Lecta is a cultural taste archive. You pick films, series, books and albums, write a line about why you love them, and arrange them into an editorial exhibition. Lecta reads that exhibition and recommends the next work that belongs in it, with the reasons behind each pick. The same capabilities are exposed to AI agents through a real **MCP server**, so an agent can use Lecta even without the web UI.

This branch (`feat/uat-editorial-mcp`) is the first-UAT MVP (2026-10-31).

## What works

| Area | What you can do |
| --- | --- |
| Web | Magazine home, Discover (search, medium filter, selection shelf), work detail, exhibition builder with live preview, exhibition page with recommendations you can add, My exhibitions, Agent lab |
| Data | 46 real works (12 films, 10 series, 12 books, 12 albums) and 4 editorial sample exhibitions in SQLite |
| Recommendation | `coldstart-v1`: deterministic, explainable cross-medium recommendations that need no user history and no API key |
| MCP | Standalone Streamable HTTP server at `127.0.0.1:3333/mcp` with 4 tools; writes need a bearer key **and** human approval |
| Agent | `agent:demo` runs a real LLM tool-calling loop over MCP when `OPENAI_API_KEY` is set (not verified in this environment, see Limitations) |

## Quick start

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env
# put a random value in LECTA_MCP_WRITE_KEY:
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

npm run db:setup      # create ./data/lecta.db and seed it (safe to re-run)
npm run dev           # web app → http://localhost:3000
npm run mcp:dev       # MCP server → http://127.0.0.1:3333/mcp   (second terminal)
npm run mcp:smoke     # protocol test: list/call tools, auth, write + read-back
npm test              # unit tests (services + recommendation)
npm run build         # production build
```

Optional:

```bash
npm i -D playwright && npx playwright install chromium
npm run test:e2e      # browser walkthrough of UAT-01/02 at 1440px and 390px (needs npm run dev or start)
npm run agent:demo    # real LLM agent over MCP — only with OPENAI_API_KEY in .env
```

## How it is built

```text
src/
  app/                    Next.js App Router pages + REST API (/api/*)
  components/             WorkCover (typographic cover plates), ExhibitionEditor, ExhibitionSpread, RecommendationPanel, …
  lib/
    db.ts                 node:sqlite connection (WAL) shared by web + MCP
    data/catalog.ts       seed works, tags, editorial exhibitions
    services/             works, exhibitions, actor (access), errors
    recommendation/       tags.ts (vocabulary + synonym matching), engine.ts (coldstart-v1)
    validators.ts         zod schemas used by the REST API and MCP
mcp/
  server.ts               standalone Streamable HTTP server (MCP TypeScript SDK v2)
  tools.ts                the 4 tools, calling the same services as the web app
scripts/                  db-setup, mcp-smoke, agent-demo, e2e-uat
db/schema.sql             portable SQL schema
tests/                    vitest
```

**One engine, two surfaces.** `/api/recommendations` and the MCP tool `recommend_for_exhibition` both call `recommend()` in `src/lib/recommendation/engine.ts`, so the agent and the UI always get the same answer.

### Stack decision: `node:sqlite` instead of Prisma

The brief suggested Prisma + SQLite. Prisma needs to download its engine binaries at install time. That download was blocked in the build environment, so Prisma could not be verified there. To keep every step verifiable, the data layer uses Node's built-in `node:sqlite` with a plain SQL schema (`db/schema.sql`), which has no native dependencies. The schema avoids SQLite-only features (TEXT ids, ISO timestamps, CHECK constraints), so moving to Postgres or Supabase later is a dialect change, not a redesign. Node prints an `ExperimentalWarning` for `node:sqlite`; this is expected.

## Data model

`users`, `works`, `work_tags`, `exhibitions`, `exhibition_items`, `taste_signals`, `recommendation_events` and `agent_activity` (see `db/schema.sql`).

- Every `Work` is one row, whatever its medium. Exhibitions, recommendations and agents all reference that row.
- `work_tags.provenance` separates `HUMAN_CURATED` tags (the team's interpretation) from future `EXTERNAL` and `LLM_SUGGESTED` ones.
- A curator note is stored as the user's own text. Tags extracted from it go into a separate `structured_tags_json` column and are never treated as confirmed taste.
- `recommendation_events` records `EXPOSED` and `ADDED` actions for future collaborative filtering.
- Unique indexes enforce one copy of a work per exhibition and one draft per `(owner, requestId)`, which makes saves idempotent.

**About the catalog.** Titles, creators and years are real and were entered by the team, so they are marked `CURATED` rather than `VERIFIED`; nothing was imported from an external API yet. No official posters or cover art are used. The UI draws its own typographic cover plates.

## Recommendation: `coldstart-v1`

```
score = 0.35·S + 0.25·W + 0.20·C + 0.10·D + 0.10·N   (weights renormalised when W or C is missing)
```

| Signal | Meaning |
| --- | --- |
| **S** context | Average of (a) the cosine between the candidate's tag vector and the seed works' mean tag vector and (b) the TF-IDF cosine between the candidate's text and the seed + exhibition text |
| **W** why | Overlap between the stated "why I liked it" reasons (free text or tag keys, resolved through a synonym dictionary in English and Korean) and the candidate's tags |
| **C** theme | Overlap between tags found in the exhibition title, introduction and curator notes and the candidate's tags |
| **D** diversity | Greedy MMR: 1 − the highest similarity to works already picked, halved when the creator repeats |
| **N** discovery | A bonus when the candidate's medium is not in the exhibition yet, a penalty when its creator is already shown |

- Excluded from results: works already in the exhibition, any `excludedWorkIds`, works with incomplete metadata, and adaptations of a seed work (same title in another medium).
- Every reason points to a real `WorkTag`, a seed work (`evidenceWorkId`) or the user's own words.
- `confidenceLabel` is `editorially_matched` when a recommendation has at least two grounded reasons and a score of 0.4 or higher. Otherwise it is `exploratory`.
- The output is deterministic, with ties broken by `workId`. No LLM or API key is involved.

## MCP server

- Endpoint: `POST http://127.0.0.1:3333/mcp` (Streamable HTTP, `@modelcontextprotocol/server` v2).
- Health: `GET /health`.
- Each request gets a fresh `McpServer` bound to the caller. A valid `Authorization: Bearer <LECTA_MCP_WRITE_KEY>` header (with `DEMO_MODE=true`) maps the caller to the demo user. Without it, the caller is anonymous.

| Tool | Kind | Notes |
| --- | --- | --- |
| `search_works` | read | `{query?, medium?, limit?}` → real IDs, tags and source |
| `get_exhibition` | read | Public exhibitions for everyone; private drafts only for the owner (otherwise `UNAUTHORIZED` or `FORBIDDEN`) |
| `recommend_for_exhibition` | read | `{exhibitionId, targetMedium?, limit?, likedReasons?}` → the same engine as the web app |
| `create_exhibition_draft` | **write** | Needs the bearer key **and** `approvedByHuman: true`. Takes 2–8 existing works with no duplicates. `requestId` makes it idempotent. Always creates a private `DRAFT`. |

Errors come back as `isError: true` with `{error: {code, message, retryable}}`. The codes are `WORK_NOT_FOUND`, `EXHIBITION_NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `CONFLICT`, `RECOMMENDATION_EMPTY` and `SERVICE_UNAVAILABLE`. Every call is logged to `agent_activity`, without secrets, and shown in `/agent-lab`.

**About the approval flag.** The server cannot know whether a person approved a write. `approvedByHuman` is a contract: the runner must ask the person first. `agent:demo` enforces it by asking `(y/N)` and setting the flag itself, so the model cannot set it.

### Connecting other MCP clients

- **MCP Inspector:** run `npx @modelcontextprotocol/inspector`, choose transport "Streamable HTTP" and URL `http://127.0.0.1:3333/mcp`. For writes, add the header `Authorization: Bearer <key>`. CORS allows `http://localhost:6274` by default (`MCP_ALLOWED_ORIGIN`).
- **Hosted assistants (ChatGPT, Claude, …):** these cannot reach `127.0.0.1`. You would need a deployment or a secure tunnel plus proper authentication. That has not been tested, so this README does not claim it works.

## REST API

| Method | Route | |
| --- | --- | --- |
| GET | `/api/health` | |
| GET | `/api/works?q=&medium=&limit=` | Search |
| GET | `/api/works/:id` | |
| GET | `/api/exhibitions` · `?mine=1` | Public exhibitions, or your own |
| POST | `/api/exhibitions` | Create a draft (`DEMO_MODE=true` only) |
| GET / PATCH | `/api/exhibitions/:id` | Owner-only edit, with `expectedVersion` conflict check |
| POST | `/api/exhibitions/:id/items` | Add a work; returns 409 if it is already there |
| POST | `/api/recommendations` | Same engine as MCP |

Errors look like `{ "error": { "code", "message", "retryable" } }` with status 400, 401, 403, 404, 409 or 503.

## Security notes

- `DEMO_MODE=true` is for local UAT only. Every web write goes to one shared demo user, and there are no real accounts yet. With it off, the site is read-only.
- Secrets live only in `.env`, which is git-ignored. The MCP key is compared in constant time and never logged.
- Inputs are validated with zod (length limits, no markup, ids restricted to `[A-Za-z0-9_-]`). Request bodies are capped at 32 KB for the API and 1 MB for MCP. No tool fetches arbitrary URLs.

## Limitations

- Only one demo user and no sign-in. "Public" sharing of user exhibitions is not built yet, so drafts stay private and "Copy link" says so.
- Metadata has not been checked against TMDB, Google Books or MusicBrainz yet (`metadataStatus = CURATED`).
- `agent:demo` was written against the OpenAI Chat Completions tools API but could not be run in the build environment (no key, no network to the model API). The MCP protocol path is verified by `mcp:smoke`.
- Fonts load from Google Fonts. Offline, the layout falls back to Georgia and system sans.
