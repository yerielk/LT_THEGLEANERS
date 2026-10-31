# UAT demo script — 2026-10-31

## Before the session

Use two terminals, with `.env` set up as described in the README.

```bash
npm run db:setup
npm run build && npm start      # or: npm run dev
npm run mcp:dev
npm run mcp:smoke               # must print PASS before you start
```

Open `http://localhost:3000`. The venue needs internet access, because artwork and fonts load from Wikimedia, Google Fonts and jsDelivr. Without it, the typographic covers and system fonts take over. The header should show **Demo workspace**.

## UAT-01: Discover → select

1. On the home page, click **Explore the collection**.
2. Search `aftersun` with **Films** selected, then click the work's **+** button.
3. Search `stoner` under **Books**, then `pink moon` under **Albums**, and select both.
4. The tray at the bottom shows 3 works. Clicking a work's **✓** removes it again, so the same work can never be added twice.
5. Search `longing`. The results span films, books and albums.
6. Negative case: search `zzqqxx`. You should see the empty state and **Reset search**, and the app does not crash.

Expected result: **Begin exhibition with 3 works** opens the builder with the same three works. These are real DB IDs: `w_film_aftersun`, `w_book_stoner` and `w_album_pink_moon`.

## UAT-02: Build → save → reload

1. Negative case: click **Save draft** with an empty title. The error "전시 제목을 입력해 주세요." appears and nothing is saved.
2. Enter the title `Longing & Other Quiet Things`, an introduction, and the note "The last dance lingers." on Aftersun.
3. Move Pink Moon up one place, then reload the page. The form is still filled in.
4. Click **Save draft**. You land on `/exhibitions/ex_…?saved=1`, labelled **Private draft**.
5. Reload. The title, order and note are unchanged. The draft is also listed in **My exhibitions**.

## UAT-03: Recommendation → agent via MCP → read-back

1. On the saved exhibition, look at **A piece that belongs here**. There are 3 recommendations, each with its reasons and a score breakdown. Toggle a reason such as `오래 남는 여운` or a medium and click **Find another piece**.
2. Click **Add to exhibition** on one recommendation. The work is hung on the room wall and is still there after a reload.
3. Run `npm run mcp:inspect` once before the session so the Inspector is cached. In MCP Inspector (or `npm run mcp:smoke`), call `find_related_works` with `{"seed_work_ids":["w_film_mood_for_love","w_book_remains_of_day"],"target_media":"book","limit":3}`. You get 3 real book IDs with titles, media and reasons. The UAT sheet's Test ID 3 uses exactly this input.
4. Open **Agent lab**. The server shows *online* with 5 tools. Click **Run protocol test** to see the real `tools/list → search_works → get_exhibition → find_related_works → recommend_for_exhibition` trace, where `find_related_works` uses the UAT-03 input (book, limit 3), with timings and IDs.
5. In a terminal, run `npm run mcp:smoke`. It checks that an anonymous write is refused (`UNAUTHORIZED`), that a write without approval is refused (`FORBIDDEN`), and that an approved write creates a draft which is then read back.
6. With `ANTHROPIC_API_KEY` set, you can instead run `npm run agent:demo`. The model chooses the tools itself and the runner asks `(y/N)` before writing. Without a key, it prints "model credentials missing", and you should call step 5 a *protocol test*, not an agent run.

## Test IDs

| What | ID |
| --- | --- |
| Seed exhibition with 4 works, mixed media | `ex_on_things_left_unsaid` |
| Other editorial samples | `ex_after_the_last_scene`, `ex_soft_focus`, `ex_strangers_familiar_places` |
| UAT-01 works | `w_film_aftersun`, `w_book_stoner`, `w_album_pink_moon` |

## Results recorded during development

These were run on 2026-10-31 in the build environment, not at the UAT venue.

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm test` | 15 / 15 passed |
| MCP protocol, including `find_related_works` | `npm run mcp:smoke` | 29 / 29 checks passed |
| Browser UAT-01/02 + add recommendation, 1440px and 390px | `npm run test:e2e` | 24 / 24 checks passed |
| Production build | `npm run build` | Passed |
| LLM agent run | `npm run agent:demo` | **Not run**: no model key in the build environment |

At the venue, mark Pass/Fail in the UAT sheet only for what you actually see.
