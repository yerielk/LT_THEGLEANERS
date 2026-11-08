/**
 * Browser walkthrough of UAT-01 (discover → select) and UAT-02 (build → save → reload), plus the
 * recommendation add-back. Needs the web app on :3000 (DEMO_MODE=true). Uses Playwright's Chromium.
 *   node scripts/e2e-uat.mjs [--shots dir]
 */
import fs from "node:fs";
import { createRequire } from "node:module";

// Playwright is optional: install it with `npm i -D playwright && npx playwright install chromium` on your machine.
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { console.error("[e2e] playwright is not installed — run: npm i -D playwright && npx playwright install chromium"); process.exit(2); }

const BASE = process.env.LECTA_APP_URL || "http://localhost:3000";
const shotsIdx = process.argv.indexOf("--shots");
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
const check = (cond, label) => { if (!cond) { console.error(`  ✗ ${label}`); process.exit(1); } passed++; console.log(`  ✓ ${label}`); };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

const browser = await chromium.launch();
try {
  for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    console.log(`\n[${label} ${viewport.width}px]`);

    await page.goto(`${BASE}/`);
    await shot(page, `${label}-home`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 1, `home has no horizontal overflow (${overflow}px)`);

    // UAT-01 negative: nonsense search → empty state
    await page.goto(`${BASE}/discover`);
    await page.getByPlaceholder(/검색/).fill("zzqqxx-not-a-work");
    await page.getByText("Reset search").waitFor({ timeout: 5000 });
    check(true, "nonsense search shows empty state with reset");
    await page.getByText("Reset search").click();

    // UAT-01: search + filter + select 3 works
    await page.getByRole("button", { name: "Films", exact: true }).click();
    await page.getByPlaceholder(/검색/).fill("aftersun");
    await page.getByRole("button", { name: /Add Aftersun to selection/ }).click();
    await page.getByPlaceholder(/검색/).fill("");
    await page.getByRole("button", { name: "Books", exact: true }).click();
    await page.getByPlaceholder(/검색/).fill("stoner");
    await page.getByRole("button", { name: /Add Stoner to selection/ }).click();
    await page.getByRole("button", { name: "Albums", exact: true }).click();
    await page.getByPlaceholder(/검색/).fill("pink moon");
    await page.getByRole("button", { name: /Add Pink Moon to selection/ }).click();
    // duplicate prevention: clicking again toggles off, then back on → still one entry
    await page.getByRole("button", { name: /Remove Pink Moon from selection/ }).click();
    await page.getByRole("button", { name: /Add Pink Moon to selection/ }).click();
    const sel = await page.evaluate(() => JSON.parse(sessionStorage.getItem("lecta.selection.v1") || "[]").map((w) => w.id));
    check(JSON.stringify(sel) === JSON.stringify(["w_film_aftersun", "w_book_stoner", "w_album_pink_moon"]), `selection holds 3 unique real DB ids: ${sel.join(", ")}`);
    await shot(page, `${label}-discover`);
    await page.getByRole("link", { name: /Begin exhibition with 3 works/ }).click();
    await page.waitForURL("**/exhibitions/new");

    // UAT-02 negative: empty title
    await page.getByRole("button", { name: "Save draft" }).click();
    check(await page.getByText("전시 제목을 입력해 주세요.").isVisible(), "empty title blocks saving with a clear error");

    // UAT-02: title, intro, note, reorder, survive refresh, save
    const title = `Longing & Other Quiet Things (${label})`;
    await page.locator("input.input-title").fill(title);
    await page.getByPlaceholder(/한두 문장/).fill("Quiet works whose feeling arrives after they end.");
    await page.getByPlaceholder(/왜 이 작품인가요/).first().fill("The last dance lingers.");
    await page.getByRole("button", { name: "Move Pink Moon up" }).click();
    await page.reload();
    await page.locator("input.input-title").waitFor();
    check((await page.locator("input.input-title").inputValue()) === title, "builder form survives a page refresh");
    await shot(page, `${label}-builder`);
    const builderIds = await page.locator(".item-row .serif").allTextContents();
    check(JSON.stringify(builderIds) === JSON.stringify(["Aftersun", "Pink Moon", "Stoner"]), `builder shows the 3 works in edited order: ${builderIds.join(" / ")}`);

    // double click → one exhibition (requestId idempotency + disabled button)
    const before = await (await ctx.request.get(`${BASE}/api/exhibitions?mine=1`)).json();
    await page.getByRole("button", { name: "Save draft" }).dblclick();
    await page.waitForURL(/\/exhibitions\/ex_[a-z0-9]+\?saved=1/);
    const id = new URL(page.url()).pathname.split("/").pop();
    const after = await (await ctx.request.get(`${BASE}/api/exhibitions?mine=1`)).json();
    check(after.exhibitions.length === before.exhibitions.length + 1, "double-click saved exactly one exhibition");

    await page.reload();
    const api = await (await ctx.request.get(`${BASE}/api/exhibitions/${id}`)).json();
    check(api.exhibition.title === title && api.exhibition.visibility === "DRAFT", `persisted draft ${id} re-read after reload`);
    check(JSON.stringify(api.exhibition.items.map((i) => i.workId)) === JSON.stringify(["w_film_aftersun", "w_album_pink_moon", "w_book_stoner"]), "persisted order matches the edit");
    check(api.exhibition.items[0].curatorNote === "The last dance lingers.", "curator note persisted");

    // recommendation → add to exhibition
    await page.locator(".rec-card").first().waitFor({ timeout: 8000 });
    const recTitle = (await page.locator(".rec-card a.serif").first().textContent()).trim();
    await shot(page, `${label}-exhibition`);
    await page.locator(".rec-card").first().getByRole("button", { name: "Add to exhibition" }).click();
    await page.getByRole("status").filter({ hasText: "추가했어요" }).waitFor({ timeout: 8000 });
    const api2 = await (await ctx.request.get(`${BASE}/api/exhibitions/${id}`)).json();
    check(api2.exhibition.items.some((i) => i.work.title === recTitle), `recommended "${recTitle}" was added and persisted`);

    check(errors.length === 0, `no uncaught page errors${errors.length ? ": " + errors.join("; ") : ""}`);
    await ctx.close();
  }
  console.log(`\n[e2e] PASS — ${passed} checks`);
} finally {
  await browser.close();
}
