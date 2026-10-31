# Lecta — THE GLEANERS

> **Lecta is a living exhibition of the things you love, and why.**

Lecta is a cultural taste archive. You pick films, series, books and albums, write a line about why you love them, and arrange them into an editorial exhibition. Lecta reads that exhibition and recommends the next work that belongs in it, with the reasons behind each pick. The same capabilities are exposed to AI agents through a real **MCP server**, so an agent can use Lecta even without the web UI.

This branch (`feat/uat-editorial-mcp`) is the first-UAT MVP (2026-10-31).

## What works

| Area | What you can do |
| --- | --- |
| Web | Magazine home, Discover (search, medium filter, selection shelf), work detail, exhibition builder with live preview, exhibition page with recommendations you can add, My exhibitions, Agent lab |
| Data | 46 real works (12 films, 10 series, 12 books, 12 albums) and 4 editorial sample exhibitions in PostgreSQL (Drizzle ORM, versioned migrations) |
| Recommendation | `coldstart-v1`: deterministic, explainable cross-medium recommendations that need no user history and no API key |
| MCP | Standalone Streamable HTTP server at `127.0.0.1:3333/mcp` with 5 tools; writes need a bearer key **and** human approval |
| Agent | `agent:demo` runs a real Claude tool-calling loop over MCP when `ANTHROPIC_API_KEY` is set (not verified in this environment, see Limitations) |

## Quick start

Requires **Node.js 22.13+** and **Docker** (for the local PostgreSQL).

```bash
npm install
cp .env.example .env  # then set the variables below

npm run db:up         # start PostgreSQL 17 (docker compose)
npm run db:setup      # apply migrations in ./drizzle and seed (safe to re-run)
npm run dev           # web app → http://localhost:3000
npm run mcp:dev       # MCP server → http://127.0.0.1:3333/mcp   (second terminal)
npm run mcp:smoke     # protocol test: list/call tools, auth, write + read-back
npm test              # unit tests on in-memory PostgreSQL (PGlite), no Docker needed
npm run build         # production build
```

`.env` variables:

| Variable | |
| --- | --- |
| `DATABASE_URL` | Defaults to the docker compose database, `postgres://lecta:lecta@127.0.0.1:5432/lecta` |
| `BETTER_AUTH_SECRET` | Random string, at least 32 characters (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally |
| `KAKAO_CLIENT_ID` | Kakao Developers → your app → REST API key |
| `KAKAO_CLIENT_SECRET` | Only if Client Secret is enabled in the Kakao app |
| `KAKAO_REQUEST_EMAIL` | `true` only when the Kakao app may request `account_email` (business app) |
| `DEMO_MODE` | `true` lets signed-out visitors save as the shared demo user (local UAT only) |
| `LECTA_MCP_KEY` | Your personal MCP key from **My exhibitions**, used by `agent:demo` |
| `LECTA_ADMIN_USER_IDS` | On a deployment, the user ids that may open `/agent-lab` (comma separated). Locally it is open to everyone |

In Kakao Developers, enable Kakao Login, add the redirect URI `http://localhost:3000/api/auth/callback/kakao`, and turn on the consent items for nickname and profile image.

To deploy on one server (Docker, Caddy HTTPS, PostgreSQL), see [docs/deploy.md](docs/deploy.md). When `BETTER_AUTH_URL` is not localhost, the web server refuses `DEMO_MODE=true`, the agent lab is limited to admins, and API and MCP requests are rate limited per IP.

Optional:

```bash
npm i -D playwright && npx playwright install chromium
npm run test:e2e      # browser walkthrough of UAT-01/02 at 1440px and 390px (needs npm run dev or start)
npm run agent:demo    # real Claude agent over MCP — only with ANTHROPIC_API_KEY in .env
```

## How it is built

```text
src/
  app/                    Next.js App Router pages + REST API (/api/*)
  components/             WorkCover (typographic cover plates), ExhibitionEditor, ExhibitionSpread, RecommendationPanel, …
  lib/
    db.ts                 PostgreSQL connection (Drizzle + pg) shared by web + MCP
    schema.ts             Drizzle schema; migrations are generated into ./drizzle
    auth.ts               Better Auth with Kakao login
    data/catalog.ts       seed works, tags, editorial exhibitions
    services/             works, exhibitions, actor (access), errors
    recommendation/       tags.ts (vocabulary + synonym matching), engine.ts (coldstart-v1)
    validators.ts         zod schemas used by the REST API and MCP
mcp/
  server.ts               standalone Streamable HTTP server (MCP TypeScript SDK v2)
  tools.ts                the 4 tools, calling the same services as the web app
scripts/                  db-setup, mcp-smoke, agent-demo, e2e-uat
drizzle/                  SQL migrations (npm run db:generate after changing schema.ts)
tests/                    vitest
```

**One engine, two surfaces.** `/api/recommendations` and the MCP tool `recommend_for_exhibition` both call `recommend()` in `src/lib/recommendation/engine.ts`, so the agent and the UI always get the same answer.

### Stack decision: PostgreSQL + Drizzle + Better Auth

The first UAT build used Node's built-in `node:sqlite`. The data layer now runs on PostgreSQL through Drizzle ORM: the schema lives in `src/lib/schema.ts`, and `drizzle-kit` generates versioned SQL migrations into `./drizzle`, which `npm run db:setup` applies. Tests run the same migrations on PGlite, an in-memory PostgreSQL, so `npm test` needs no Docker.

Sign-in uses Better Auth with Kakao. A Kakao app only gets the user's email once it is business-verified, and requesting the `account_email` scope without that permission fails the login (KOE205). Lecta therefore asks for nickname and profile image only, and stores a non-deliverable placeholder email (`kakao_<id>@users.lecta.invalid`) because Better Auth requires one.

## Design — a white gallery

The design direction is a white-walled exhibition space. Each exhibition is a **room**: it has a painted entrance wall, and its works hang on a single eye line with museum-style wall labels. The UI uses no boxed cards or bordered cells; controls are filled pills, underlined text, or plain words marked with a dot.

| Element | Choice |
| --- | --- |
| Room wall colours | From Sanzo Wada, *A Dictionary of Color Combinations* (1933), via the open dataset [mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations): Deep Lyons Blue `#1c4286`, Etruscan Red `#c55347`, Yellow Ocher `#e2b540`, Green Blue `#099197`, Old Rose `#d46d7a`, Oil Green `#819238`. They were chosen to be vivid but calm (saturation 0.45–1.0, lightness 0.3–0.6). See `src/lib/design.ts`. |
| Type | All fonts are SIL OFL: **Instrument Serif** for display and wall text, **Instrument Sans** for labels and UI, **Pretendard** for Korean text, and **Gowun Batang** for Korean quotes. |
| Artwork | Official posters, covers and album art, hot-linked from the Wikipedia infobox image of each work (`src/lib/data/artwork.ts`, 40 of 46 works). Each image belongs to its rights holder and is shown for identification, with a source link on the work page. Works without an image, or whose image fails to load, show Lecta's typographic cover. Wikipedia hosts non-free images at about 220–380px, so works are hung at modest sizes. |
| Transitions | The View Transitions API via `next-view-transitions`. A room's painted wall morphs from the home page into the room, an artwork glides from Discover or a room into its detail page, and Discover re-hangs the grid with motion when filters change. `prefers-reduced-motion` turns all of this off. |
| Room page | The wall scrolls horizontally on desktop: the mouse wheel walks along it and arrow keys work, with a progress line underneath. On mobile it becomes a vertical walk. |

Layout references: MUBI Notebook (oversized type and editorial rhythm), Apartamento (space and personal notes), A24 (a catalog led by the artwork), and Are.na (collecting and arranging). These informed mood only; no layouts or assets were copied.

## Data model

`users`, `sessions`, `accounts` and `verifications` (Better Auth), `api_keys`, `works`, `work_tags`, `exhibitions`, `exhibition_items`, `taste_signals`, `recommendation_events` and `agent_activity` (see `src/lib/schema.ts`).

- Every `Work` is one row, whatever its medium. Exhibitions, recommendations and agents all reference that row.
- `work_tags.provenance` separates `HUMAN_CURATED` tags (the team's interpretation) from future `EXTERNAL` and `LLM_SUGGESTED` ones.
- A curator note is stored as the user's own text. Tags extracted from it go into a separate `structured_tags_json` column and are never treated as confirmed taste.
- `recommendation_events` records `EXPOSED` and `ADDED` actions for future collaborative filtering.
- Unique indexes enforce one copy of a work per exhibition and one draft per `(owner, requestId)`, which makes saves idempotent.

**About the catalog.** Titles, creators and years are real and were entered by the team, so they are marked `CURATED` rather than `VERIFIED`; nothing was imported from an external API yet. No official posters or cover art are used. The UI draws its own typographic cover plates.

## Recommendation: `coldstart-v1`

```
score = 0.35*S + 0.25*W + 0.20*C + 0.10*D + 0.10*N   (weights renormalised when W or C is missing)
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
- Each request gets a fresh `McpServer` bound to the caller. `Authorization: Bearer <personal MCP key>` maps the caller to the key's owner. Signed-in users issue and revoke keys under **My exhibitions**; only a SHA-256 hash is stored. Without a valid key, the caller is anonymous.

| Tool | Kind | Notes |
| --- | --- | --- |
| `search_works` | read | `{query?, medium?, limit?}` → real IDs, tags and source |
| `find_related_works` | read | `{seed_work_ids?, collection_id?, target_media?, limit?, liked_reasons?}` → related real works with reasons (the UAT-03 tool; same engine) |
| `get_exhibition` | read | Public exhibitions for everyone; private drafts only for the owner (otherwise `UNAUTHORIZED` or `FORBIDDEN`) |
| `recommend_for_exhibition` | read | `{exhibitionId, targetMedium?, limit?, likedReasons?}` → the same engine as the web app |
| `create_exhibition_draft` | **write** | Needs a personal MCP key **and** `approvedByHuman: true`. The draft belongs to the key's owner. Takes 2–8 existing works with no duplicates. `requestId` makes it idempotent. Always creates a private `DRAFT`. |

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
| GET | `/api/exhibitions`, `?mine=1` | Public exhibitions, or your own |
| POST | `/api/exhibitions` | Create a draft (signed in, or `DEMO_MODE=true`) |
| GET / POST | `/api/me/api-keys` | List or issue personal MCP keys (signed in) |
| DELETE | `/api/me/api-keys/:id` | Revoke a key |
| * | `/api/auth/*` | Better Auth (Kakao sign-in, callback, sign-out) |
| GET / PATCH | `/api/exhibitions/:id` | Owner-only edit, with `expectedVersion` conflict check |
| POST | `/api/exhibitions/:id/items` | Add a work; returns 409 if it is already there |
| POST | `/api/recommendations` | Same engine as MCP |

Errors look like `{ "error": { "code", "message", "retryable" } }` with status 400, 401, 403, 404, 409 or 503.

## Security notes

- Writes need a Kakao sign-in. `DEMO_MODE=true` is for local UAT only: signed-out visitors then save as one shared demo user. With it off, signed-out visitors can only read.
- Secrets live only in `.env`, which is git-ignored. MCP keys are stored as SHA-256 hashes, shown once when issued, and never logged. An agent cannot issue or revoke keys with the key it holds.
- Inputs are validated with zod (length limits, no markup, ids restricted to `[A-Za-z0-9_-]`). Request bodies are capped at 32 KB for the API and 1 MB for MCP. No tool fetches arbitrary URLs.

## Limitations

- Kakao is the only sign-in method. "Public" sharing of user exhibitions is not built yet, so drafts stay private and "Copy link" says so.
- Metadata has not been checked against TMDB, Google Books or MusicBrainz yet (`metadataStatus = CURATED`).
- `agent:demo` uses the Anthropic Messages API (`@anthropic-ai/sdk`, default model `claude-opus-5-5`, override with `ANTHROPIC_MODEL`) but has not been run against the live API yet. The MCP protocol path is verified by `mcp:smoke`.
- Fonts load from Google Fonts. Offline, the layout falls back to Georgia and system sans.
