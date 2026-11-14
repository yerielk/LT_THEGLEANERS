/* Curation Editor v5 end-to-end checks. Run (static server on :8791 first): node qa/e2e.cjs [outDir]. Needs the playwright package; CHROME_PATH optional */
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = 'http://localhost:8791/curation-editor-v5.html';
const OUT = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function rec(name, ok, detail) { results.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(ctx, url, errs) {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
  page.on('dialog', (d) => { errs.push('[dialog] ' + d.message()); d.dismiss(); });
  await page.goto(url);
  await ready(page);
  return page;
}
/* wait until the template iframe has rendered and reported state */
async function ready(page) {
  await page.waitForFunction(() => { const f = document.getElementById('frame'); try { return f.contentWindow.Lecta && f.contentWindow.Lecta.last && document.querySelector('#seq small') && /auto|fixed/.test(document.querySelector('#seq .row:not(.cover) small').textContent); } catch (e) { return false; } }, null, { timeout: 15000 });
  await sleep(250);
}
const railTitles = (p) => p.$$eval('#seq .row:not(.cover) .tt b', (bs) => bs.map((b) => b.textContent));
const railNums = (p) => p.$$eval('#seq .row:not(.cover) .n', (bs) => bs.map((b) => b.textContent));
const dataIds = (p) => p.evaluate(() => LectaEditor.getData().items.map((i) => i.id));
const dataTitles = (p) => p.evaluate(() => LectaEditor.getData().items.map((i) => i.title));
const frameIds = (p) => p.evaluate(() => document.getElementById('frame').contentWindow.Lecta.last.items.map((i) => i.id));
async function waitFrameOrder(p, ids) {
  try { await p.waitForFunction((ids) => { const L = document.getElementById('frame').contentWindow.Lecta; return L && L.last && L.last.items.map((i) => i.id).join() === ids.join(); }, ids, { timeout: 6000 }); return true; } catch (e) { return false; }
}
async function dragRow(page, fromIdx, toGapIdx, opts) {
  const grip = page.locator('#seq .row:not(.cover) .grip').nth(fromIdx);
  await page.locator('#seq .row:not(.cover)').nth(fromIdx).hover();
  const gb = await grip.boundingBox();
  const rows = page.locator('#seq .row:not(.cover)');
  const n = await rows.count();
  let ty;
  if (toGapIdx < n) { const rb = await rows.nth(toGapIdx).boundingBox(); ty = rb.y + 6; } else { const rb = await rows.nth(n - 1).boundingBox(); ty = rb.y + rb.height - 4; }
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2 + (ty > gb.y ? 8 : -8), { steps: 3 });
  await page.mouse.move(gb.x + gb.width / 2, ty, { steps: 10 });
  if (opts && opts.beforeUp) await opts.beforeUp();
  await page.mouse.up();
  await sleep(150);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const errsAll = [];

  /* ================= 1. Drag reorder A,B,C -> C,A,B, persistence ================= */
  {
    const errs = []; const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await open(ctx, BASE + '?fresh=1', errs);
    const ids0 = await dataIds(page), t0 = await railTitles(page);
    rec('1.0 sample has 3 works', t0.length === 3, t0.join(' | '));
    /* select work 2 first, so we can check the selection survives the drag */
    await page.locator('#seq .row:not(.cover) .pick').nth(1).click();
    await dragRow(page, 2, 0);
    const t1 = await railTitles(page), ids1 = await dataIds(page);
    const expectIds = [ids0[2], ids0[0], ids0[1]];
    rec('1.1 rail order after drag C to top', t1.join() === [t0[2], t0[0], t0[1]].join(), t1.join(' | '));
    rec('1.2 rail numbers 01..03', (await railNums(page)).join() === '01,02,03');
    rec('1.3 getData().items order by stable id', ids1.join() === expectIds.join());
    rec('1.4 preview (iframe Lecta.last) follows order', await waitFrameOrder(page, expectIds), (await frameIds(page)).join());
    const sel = await page.evaluate(() => document.querySelector('#seq .row.on').getAttribute('data-id'));
    rec('1.5 selection kept on the same work through the drag', sel === ids0[1], sel);
    rec('1.6 write surface still shows the selected work', (await page.inputValue('#write [data-f="title"]')) === t0[1]);
    rec('1.7 write meta number updated to new position', (await page.textContent('#w-num')) === '03');
    /* save, reload, compare */
    await page.click('.acts [data-act="save"]'); await sleep(200);
    await page.goto(BASE); await ready(page);
    rec('1.8 order survives save + reload', (await dataIds(page)).join() === expectIds.join(), (await railTitles(page)).join(' | '));
    rec('1.9 ids stable across reload (no new uid)', (await dataIds(page)).join() === ids1.join());
    rec('1.10 selected work restored by id', (await page.evaluate(() => document.querySelector('#seq .row.on').getAttribute('data-id'))) === ids0[1]);
    rec('1.11 preview order after reload', await waitFrameOrder(page, expectIds));

    /* ================= 2. no-op, cancel, cover, pick-drag, undo ================= */
    let saves = 0; await page.exposeFunction('__countSave', () => { saves++; });
    await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'lecta.curation.draft.v3') window.__countSave(); return o.call(this, k, v); }; });
    const before = await dataIds(page);
    await dragRow(page, 1, 1); await sleep(1200);
    rec('2.1 dropping in place changes nothing', (await dataIds(page)).join() === before.join());
    rec('2.2 dropping in place causes no save', saves === 0, 'saves=' + saves);
    await dragRow(page, 0, 3, { beforeUp: async () => { await page.keyboard.press('Escape'); } });
    rec('2.3 Escape during drag cancels', (await dataIds(page)).join() === before.join());
    rec('2.4 drag visuals cleared after cancel', await page.evaluate(() => !document.querySelector('.row.dragging') && !document.querySelector('#dropline.on') && !document.querySelector('.ghostrow')));
    rec('2.5 cover row has no drag handle button', await page.evaluate(() => !document.querySelector('#seq .row.cover button.grip')));
    /* drag starting on the row body (not the handle) must not reorder */
    const pb = await page.locator('#seq .row:not(.cover) .pick').nth(0).boundingBox();
    await page.mouse.move(pb.x + 60, pb.y + 20); await page.mouse.down(); await page.mouse.move(pb.x + 60, pb.y + 160, { steps: 8 }); await page.mouse.up(); await sleep(200);
    rec('2.6 dragging the row body does not reorder', (await dataIds(page)).join() === before.join());
    /* typing in an input never starts a drag */
    rec('2.7 handles are the only drag source (touch-action:none on grip only)', await page.evaluate(() => getComputedStyle(document.querySelector('.grip')).touchAction === 'none' && getComputedStyle(document.querySelector('.pick')).touchAction !== 'none'));
    await dragRow(page, 0, 3);
    const afterMove = await dataIds(page);
    rec('2.8 drag to the end', afterMove.join() === [before[1], before[2], before[0]].join());
    await page.click('#write .w-meta'); await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await sleep(150);
    rec('2.9 Cmd/Ctrl+Z outside text undoes the move', (await dataIds(page)).join() === before.join(), (await dataIds(page)).join());
    await dragRow(page, 2, 0);
    await page.click('#toast-u'); await sleep(150);
    rec('2.10 toast Undo restores order', (await dataIds(page)).join() === before.join());
    rec('2.11 preview back to original order after undo', await waitFrameOrder(page, before));

    /* ================= 3. keyboard and menu alternatives ================= */
    await page.locator('#seq .row:not(.cover) .grip').nth(0).focus();
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    rec('3.1 lifted row shows drop line', await page.evaluate(() => document.querySelector('#dropline').classList.contains('on')));
    await page.keyboard.press('Space'); await sleep(150);
    const k1 = await dataIds(page);
    rec('3.2 keyboard Space/arrows/Space moves 1st to 3rd', k1.join() === [before[1], before[2], before[0]].join());
    rec('3.3 focus returns to the moved handle', await page.evaluate((id) => document.activeElement.classList.contains('grip') && document.activeElement.closest('.row').getAttribute('data-id') === id, before[0]));
    await page.keyboard.press('Space'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Escape'); await sleep(100);
    rec('3.4 Escape cancels a keyboard lift', (await dataIds(page)).join() === k1.join());
    await page.keyboard.press('Alt+ArrowUp'); await sleep(100);
    rec('3.5 Alt+ArrowUp moves one step', (await dataIds(page)).join() === [before[1], before[0], before[2]].join());
    await page.locator('#seq .row:not(.cover) .rmore').nth(2).click();
    rec('3.6 row menu opens with move items', await page.isVisible('#menu') && (await page.textContent('#menu')).includes('맨 위로'));
    rec('3.7 menu disables impossible moves', await page.evaluate(() => [...document.querySelectorAll('#menu button')].filter((b) => b.disabled).map((b) => b.textContent).join()), );
    await page.click('#menu button:has-text("맨 위로")'); await sleep(150);
    rec('3.8 menu "맨 위로" moves last to first', (await dataIds(page)).join() === [before[2], before[1], before[0]].join());
    await page.locator('#seq .row:not(.cover) .rmore').nth(0).click(); await page.keyboard.press('Escape');
    rec('3.9 Esc closes menu and returns focus to its button', await page.evaluate(() => document.getElementById('menu').hidden && document.activeElement.classList.contains('rmore')));

    /* many works + autoscroll */
    await page.setViewportSize({ width: 1440, height: 560 });
    await page.evaluate(() => { const d = LectaEditor.getData(); const D = LectaSamples.SETS.D.ex.items; d.items = d.items.concat(D.map((x, i) => Object.assign({}, x, { id: 'many' + i }))).concat(LectaSamples.SETS.A.ex.items.map((x, i) => Object.assign({}, x, { id: 'manyA' + i }))); LectaEditor.setData(d); });
    await ready(page);
    const n = (await dataIds(page)).length;
    const g0 = page.locator('#seq .row:not(.cover) .grip').nth(0);
    await page.locator('#seq .row:not(.cover)').nth(0).hover();
    const gbb = await g0.boundingBox(), railBox = await page.locator('#rail').boundingBox();
    const firstId = (await dataIds(page))[0];
    await page.mouse.move(gbb.x + 10, gbb.y + 10); await page.mouse.down();
    await page.mouse.move(gbb.x + 10, gbb.y + 30, { steps: 3 });
    await page.mouse.move(gbb.x + 10, railBox.y + railBox.height - 8, { steps: 6 });
    await sleep(2500);
    const scrolled = await page.evaluate(() => document.getElementById('rail').scrollTop);
    await page.mouse.up(); await sleep(200);
    const ids2 = await dataIds(page);
    rec('3.10 autoscroll at rail edge with ' + n + ' works', scrolled > 200, 'scrollTop=' + scrolled);
    rec('3.11 long list drop lands far down', ids2.indexOf(firstId) > 8, 'new index ' + ids2.indexOf(firstId));
    await page.screenshot({ path: path.join(OUT, 'drag-many-1440.png') });
    errsAll.push(...errs.map((e) => 'suite1: ' + e));
    rec('3.12 no console errors (suites 1-3)', !errs.length, errs.slice(0, 3).join(' / '));
    await ctx.close();
  }

  /* ================= 4. Mobile touch drag (handle only) ================= */
  {
    const errs = []; const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
    const page = await open(ctx, BASE + '?fresh=1', errs);
    rec('4.0 no horizontal scroll at 390', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(OUT, 'mobile-390-write.png') });
    await page.tap('#rail-btn'); await sleep(200);
    rec('4.1 sequence opens as drawer on phone', await page.evaluate(() => document.body.classList.contains('rail-open') && getComputedStyle(document.getElementById('rail')).position === 'fixed'));
    await page.screenshot({ path: path.join(OUT, 'mobile-390-sequence.png') });
    const before = await dataIds(page);
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const g = await page.locator('#seq .row:not(.cover) .grip').nth(2).boundingBox();
    const r0 = await page.locator('#seq .row:not(.cover)').nth(0).boundingBox();
    await touch('touchStart', g.x + g.width / 2, g.y + g.height / 2);
    for (let i = 1; i <= 10; i++) { await touch('touchMove', g.x + g.width / 2, g.y + g.height / 2 + (r0.y + 6 - (g.y + g.height / 2)) * i / 10); await sleep(16); }
    await touch('touchEnd'); await sleep(250);
    rec('4.2 touch drag by handle reorders', (await dataIds(page)).join() === [before[2], before[0], before[1]].join(), (await railTitles(page)).join(' | '));
    const after = await dataIds(page);
    const p = await page.locator('#seq .row:not(.cover) .pick').nth(0).boundingBox();
    await touch('touchStart', p.x + 80, p.y + 20);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', p.x + 80, p.y + 20 + i * 15); await sleep(16); }
    await touch('touchEnd'); await sleep(200);
    rec('4.3 touch swipe on row body does not reorder', (await dataIds(page)).join() === after.join());
    await page.tap('#seq .row:not(.cover) .pick >> nth=1'); await sleep(200);
    rec('4.4 tapping a row selects it and closes the drawer', await page.evaluate(() => !document.body.classList.contains('rail-open')) && (await page.inputValue('#write [data-f="title"]')) === (await dataTitles(page))[1]);
    await page.tap('#tab-design'); await sleep(600);
    rec('4.5 design mode on phone: no horizontal scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(OUT, 'mobile-390-design.png') });
    await page.tap('#det-btn'); await sleep(200);
    rec('4.6 details drawer opens on phone', await page.evaluate(() => document.body.classList.contains('det-open')));
    await page.screenshot({ path: path.join(OUT, 'mobile-390-details.png') });
    await page.keyboard.press('Escape');
    await page.tap('#tab-preview'); await sleep(800);
    await page.screenshot({ path: path.join(OUT, 'mobile-390-preview.png') });
    rec('4.7 preview on phone fills width', await page.evaluate(() => { const f = document.getElementById('frame').getBoundingClientRect(); return f.width >= 380 && f.left >= 0; }));
    errsAll.push(...errs.map((e) => 'suite4: ' + e));
    rec('4.8 no console errors (mobile)', !errs.length, errs.slice(0, 3).join(' / '));
    await ctx.close();
  }

  /* ================= 5-7. Long Korean writing, IME, formatting, modes, save ================= */
  {
    const errs = []; const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await open(ctx, BASE + '?fresh=1', errs);
    const cdp = await ctx.newCDPSession(page);
    await page.locator('#seq .row:not(.cover) .pick').nth(1).click();
    const ta = page.locator('#w-note');
    await ta.click();
    rec('5.1 note editor is in the centre workspace, >= 60vh', await page.evaluate(() => { const t = document.getElementById('w-note'), r = t.getBoundingClientRect(); return r.height >= innerHeight * 0.6 - 2 && r.width >= 560 && r.width <= 720; }), await page.evaluate(() => Math.round(document.getElementById('w-note').getBoundingClientRect().width) + 'px wide'));
    rec('5.2 body font MaruBuri 17-19px, line-height 1.8-1.95', await page.evaluate(() => { const c = getComputedStyle(document.getElementById('w-note')); const fs = parseFloat(c.fontSize), lh = parseFloat(c.lineHeight) / fs; return /MaruBuri/.test(c.fontFamily) && fs >= 17 && fs <= 19 && lh >= 1.8 && lh <= 1.95; }));
    /* real IME composition sequence for 한글: ㅎ -> 하 -> 한, commit; then 글 */
    const ime = async (steps, commit) => { for (const s of steps) await cdp.send('Input.imeSetComposition', { text: s, selectionStart: s.length, selectionEnd: s.length }); await cdp.send('Input.insertText', { text: commit }); };
    await ime(['ㅎ', '하', '한'], '한'); await ime(['ㄱ', '그', '글'], '글');
    rec('5.3 IME composition commits 한글 without breaking focus', (await ta.inputValue()) === '한글' && await page.evaluate(() => document.activeElement.id === 'w-note'), await ta.inputValue());
    const para = '이 작품을 처음 만난 날의 공기를 아직 기억한다. 문장 하나가 오래 남는 이유는 그것을 읽던 때의 내가 어디에 있었는지 때문이다. 같은 작품을 다른 시간에 다시 보면 다른 장면이 먼저 떠오른다. ';
    let body = '';
    for (let i = 0; i < 7; i++) body += '\n\n' + para.repeat(3).trim();
    await page.keyboard.insertText(body);
    await page.keyboard.insertText('\n\n> 기억은 사진보다 느리게 도착한다.\n> 그리고 오래 머문다.\n\n마지막 문단이다.');
    const v = await ta.inputValue();
    rec('5.4 long Korean text >= 2000 chars typed', v.replace(/\s/g, '').length >= 1200 && v.length >= 2000, v.length + ' chars');
    rec('5.5 blank lines kept (paragraph breaks)', (v.match(/\n\n/g) || []).length >= 7);
    rec('5.6 textarea keeps focus while typing; no re-render', await page.evaluate(() => document.activeElement.id === 'w-note'));
    rec('5.7 counts update quietly', /자\s+\d+문단/.test(await page.textContent('#counts')), await page.textContent('#counts'));
    rec('5.8 getData note equals the editor text (no copy, no reason merge)', await page.evaluate(() => { const d = LectaEditor.getData(), w = d.items[1]; return w.note === document.getElementById('w-note').value && w.note.indexOf(w.reason) !== 0; }));
    /* bold on selection */
    const idx = v.indexOf('공기를');
    await page.evaluate((i) => document.getElementById('w-note').setSelectionRange(i, i + 3), idx);
    await page.click('[data-fmt="b"]');
    const vb = await ta.inputValue();
    rec('5.9 B wraps the selection in **', vb.slice(idx, idx + 7) === '**공기를**', vb.slice(idx - 2, idx + 10));
    rec('5.10 selection stays on the word after B', await page.evaluate(() => { const t = document.getElementById('w-note'); return t.value.slice(t.selectionStart, t.selectionEnd) === '공기를' && document.activeElement === t; }));
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    rec('5.11 native undo in textarea removes the bold', (await ta.inputValue()).slice(idx, idx + 3) === '공기를' && (await ta.inputValue()).indexOf('**공기를**') < 0);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+y');
    rec('5.12 native redo brings it back', (await ta.inputValue()).indexOf('**공기를**') > -1);
    const j = (await ta.inputValue()).indexOf('장면이');
    await page.evaluate((i) => document.getElementById('w-note').setSelectionRange(i, i + 3), j);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+i' : 'Control+i');
    rec('5.13 Cmd/Ctrl+I wraps in *', (await ta.inputValue()).indexOf('*장면이*') > -1);
    /* quote on a multi-line selection inside the last paragraph block */
    await page.evaluate(() => { const t = document.getElementById('w-note'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
    await page.keyboard.insertText('\n첫 줄 인용\n둘째 줄 인용');
    await page.evaluate(() => { const t = document.getElementById('w-note'), s = t.value.lastIndexOf('첫 줄'); t.setSelectionRange(s, t.value.length); });
    await page.click('[data-fmt="q"]');
    const vq = await ta.inputValue();
    rec('5.14 Quote prefixes each selected line and separates the block', /마지막 문단이다\.\n\n> 첫 줄 인용\n> 둘째 줄 인용$/.test(vq), JSON.stringify(vq.slice(-40)));
    const parsed = await page.evaluate(() => document.getElementById('frame').contentWindow.Lecta.parseNote(document.getElementById('w-note').value));
    rec('5.15 template parser reads 2 quotes and >= 7 paragraphs', parsed.quotes.length === 2 && parsed.paras.length >= 7 && parsed.quotes[1] === '첫 줄 인용\n둘째 줄 인용', 'quotes=' + parsed.quotes.length + ' paras=' + parsed.paras.length);
    /* scroll stays put while typing at the end of a long text */
    await page.evaluate(() => { const t = document.getElementById('w-note'); t.setSelectionRange(t.value.length, t.value.length); });
    await page.keyboard.insertText(' 끝.');
    const caretVisible = await page.evaluate(() => { const w = document.getElementById('write'); const t = document.getElementById('w-note').getBoundingClientRect(); return t.bottom >= w.getBoundingClientRect().top && w.scrollTop > 0; });
    rec('5.16 long text grows the page and keeps the end in view', caretVisible);
    /* paste multi-paragraph text */
    await page.evaluate(() => { const t = document.getElementById('w-note'); const dt = new DataTransfer(); dt.setData('text/plain', '\n\n붙여넣은 문단 하나.\r\n\r\n붙여넣은 문단 둘.'); t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    await page.keyboard.insertText('\n\n붙여넣은 문단 셋.');
    rec('5.17 paste-like insert keeps paragraphs', (await ta.inputValue()).endsWith('붙여넣은 문단 셋.'));
    /* reason: underline field, single line */
    await page.click('#w-reason'); await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a'); await page.keyboard.insertText('낮은 목소리 하나로 방 안의 온도가 달라진다.'); await page.keyboard.press('Enter');
    rec('5.18 reason is an underline field and stays one line', await page.evaluate(() => { const r = document.getElementById('w-reason'), c = getComputedStyle(r); return !/\n/.test(r.value) && c.borderBottomWidth === '1px' && c.borderTopWidth === '0px' && c.backgroundColor === 'rgba(0, 0, 0, 0)'; }));
    /* preview gets the same text */
    const marker = '마지막 문단이다';
    await page.click('#tab-design'); await sleep(900);
    rec('5.19 design preview renders the new paragraphs', await page.evaluate((m) => document.getElementById('frame').contentDocument.body.innerText.indexOf(m) > -1, marker));
    rec('5.20 bucket stays template-compatible (long)', await page.evaluate(() => document.getElementById('frame').contentWindow.Lecta.last.items[1].bucket === 'long'));
    /* 6. caret round trip */
    await page.click('#tab-write');
    await page.evaluate(() => { const t = document.getElementById('w-note'); t.focus(); t.setSelectionRange(123, 130); });
    await page.click('#tab-design'); await sleep(300);
    await page.click('#tab-preview'); await sleep(300);
    await page.keyboard.press('Escape'); await sleep(200);
    rec('6.1 Esc from preview returns to previous mode', await page.evaluate(() => document.body.classList.contains('mode-design')));
    await page.locator('#seq .row.cover .pick').click(); await sleep(200);
    await page.click('#det [data-act="tpl"][data-v="afterimage"]'); await ready(page);
    await page.click('#det [data-act="tpl"][data-v="the-edit"]'); await ready(page);
    await page.locator('#seq .row:not(.cover) .pick').nth(1).click(); await sleep(200);
    await page.click('#tab-write'); await sleep(150);
    const caret = await page.evaluate(() => { const t = document.activeElement; return t.id + ':' + t.selectionStart + '-' + t.selectionEnd; });
    rec('6.2 caret and selection restored after Write>Design>Preview>template>Write', caret === 'w-note:123-130', caret);
    rec('6.3 text intact after template switches', (await ta.inputValue()).endsWith('붙여넣은 문단 셋.'));
    /* focus mode */
    await page.click('#focus-btn'); await sleep(150);
    rec('6.4 Focus hides bar, rail and tabs', await page.evaluate(() => ['.bar', '.rail', '.wbar'].every((s) => getComputedStyle(document.querySelector(s)).display === 'none') && document.activeElement.id === 'w-note'));
    await page.screenshot({ path: path.join(OUT, 'focus-1440.png') });
    await page.keyboard.press('Escape'); await sleep(100);
    rec('6.5 Esc leaves Focus', await page.evaluate(() => !document.body.classList.contains('focus')));
    /* 7. scene upload, quota, save, reload, export */
    await page.click('#tab-design'); await sleep(300);
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d'); for (let i = 0; i < 40; i++) { x.fillStyle = 'hsl(' + i * 9 + ',60%,50%)'; x.fillRect(0, i * 30, 900, 30); } return c.toDataURL('image/png').split(',')[1]; });
    await page.setInputFiles('#det [data-scenes]', { name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForFunction(() => LectaEditor.getData().items[1].scenes.length === 1);
    await page.fill('#det .cap-in', '세로 사진 캡션');
    rec('7.1 portrait scene keeps its ratio in details (no crop)', await page.evaluate(() => { const im = document.querySelector('#det .sc .im'); const r = im.getBoundingClientRect(); return getComputedStyle(im).objectFit === 'contain' && r.height > r.width; }));
    rec('7.2 scene ar saved in data', await page.evaluate(() => Math.abs(LectaEditor.getData().items[1].scenes[0].ar - 0.75) < 0.01));
    await page.click('.acts [data-act="save"]'); await sleep(200);
    const snap = await page.evaluate(() => LectaEditor.getData());
    await page.goto(BASE); await ready(page);
    const back = await page.evaluate(() => LectaEditor.getData());
    const strip = (d) => JSON.stringify(Object.assign({}, d, { focus: null, items: d.items.map((i) => Object.assign({}, i, { palette: null })) }));
    rec('7.3 reload restores ids, order, title, reason, note, scenes, template', strip(snap) === strip(back), 'template=' + back.template);
    rec('7.4 palette persisted', back.items.every((i) => Array.isArray(i.palette) && i.palette.length));
    rec('7.5 mode and selection restored', await page.evaluate(() => document.body.classList.contains('mode-design') && document.querySelector('#seq .row.on .tt b').textContent === 'Come Away With Me'));
    rec('7.6 v2 key untouched by v5', await page.evaluate(() => localStorage.getItem('lecta.curation.draft.v2') === null));
    /* JSON export via More */
    await page.click('#more-btn');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#menu button:has-text("Download JSON")')]);
    const jp = path.join(OUT, 'export.json'); await dl.saveAs(jp);
    const ej = JSON.parse(fs.readFileSync(jp, 'utf8'));
    rec('7.7 JSON export has same items, note and scene', strip(ej) === strip(back) && ej.items[1].scenes[0].caption === '세로 사진 캡션');
    /* quota: force a small storage limit */
    await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'lecta.curation.draft.v3' && v.indexOf('data:image/jpeg') > -1) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
    await page.click('.acts [data-act="save"]'); await sleep(200);
    const st = await page.evaluate(() => ({ t: document.getElementById('saved').textContent, warn: document.getElementById('saved').classList.contains('warn'), toast: document.getElementById('toast-t').textContent, hint: (document.querySelector('#det .hint.warn') || {}).textContent || '' }));
    rec('7.8 quota: explicit status, toast and details warning', /without 1 image/.test(st.t) && st.warn && /이미지 1개/.test(st.toast) && /1개/.test(st.hint), st.t + ' / ' + st.toast);
    rec('7.9 quota: text and order still saved', await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('lecta.curation.draft.v3')); return r.dropped === 1 && r.data.items[1].note.endsWith('붙여넣은 문단 셋.') && r.data.items[1].scenes.length === 0; }));
    errsAll.push(...errs.map((e) => 'suite5: ' + e));
    rec('7.10 no console errors (writing suite)', !errs.length, errs.slice(0, 3).join(' / '));
    await ctx.close();
  }

  /* ================= v2 migration ================= */
  {
    const errs = []; const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(BASE + '?fresh=1');
    const v2 = { title: 'V2 draft', template: 'the-edit', items: [{ id: 'keep-a', title: 'Alpha', medium: 'film', note: 'a' }, { id: 'keep-b', title: 'Beta', medium: 'book', note: 'b' }, { id: 'keep-b', title: 'Dup id', medium: 'album' }, { title: 'No id', medium: 'series' }] };
    await page.evaluate((v2) => { localStorage.clear(); localStorage.setItem('lecta.curation.draft.v2', JSON.stringify(v2)); }, v2);
    await page.goto(BASE); await ready(page);
    const ids = await dataIds(page);
    rec('8.1 v2 draft opens, saved ids kept', ids[0] === 'keep-a' && ids[1] === 'keep-b', ids.join());
    rec('8.2 duplicate and missing ids repaired uniquely', new Set(ids).size === 4 && ids[2] !== 'keep-b' && !!ids[3]);
    rec('8.3 status says v2 draft', /v2/.test(await page.textContent('#saved')));
    await page.click('.acts [data-act="save"]'); await sleep(150);
    rec('8.4 v2 record unchanged, v3 written', await page.evaluate((s) => localStorage.getItem('lecta.curation.draft.v2') === s && JSON.parse(localStorage.getItem('lecta.curation.draft.v3')).schema === 3, JSON.stringify(v2)));
    await page.reload(); await ready(page);
    rec('8.5 v3 reload keeps repaired ids', (await dataIds(page)).join() === ids.join());
    rec('8.6 ?fresh=1 starts from the sample', await (async () => { await page.goto(BASE + '?fresh=1'); await ready(page); return (await railTitles(page))[0] === 'Aftersun'; })());
    rec('8.7 no page errors (migration)', !errs.length, errs.join(' / '));
    await ctx.close();
  }

  /* ================= templates x samples A-D, XSS, overflow ================= */
  {
    const errs = []; const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await open(ctx, BASE + '?fresh=1', errs);
    for (const tpl of ['the-spread', 'the-edit', 'afterimage']) {
      for (const k of ['A', 'B', 'C', 'D']) {
        await page.evaluate(([tpl, k]) => { const ex = JSON.parse(JSON.stringify(LectaSamples.SETS[k].ex)); ex.template = tpl; LectaEditor.setData(ex); }, [tpl, k]);
        await ready(page);
        const r = await page.evaluate(() => {
          const f = document.getElementById('frame'), fd = f.contentDocument, L = f.contentWindow.Lecta;
          return { n: L.last.items.length, want: LectaEditor.getData().items.length, ovf: fd.documentElement.scrollWidth - fd.documentElement.clientWidth, edOvf: document.documentElement.scrollWidth - innerWidth, imgs: fd.querySelectorAll('img[onerror], script:not([src])').length, plan: (L.planned || []).length, tpl: f.getAttribute('src') };
        });
        rec(`9 ${tpl} set ${k}: renders ${r.n}/${r.want}, plan ${r.plan}, overflow ${r.ovf}`, r.n === r.want && r.ovf <= 0 && r.edOvf <= 0 && r.plan === r.n && r.tpl.indexOf(tpl) === 0);
      }
    }
    /* XSS strings show as text in the editor */
    await page.evaluate(() => LectaEditor.setData(JSON.parse(JSON.stringify(LectaSamples.SETS.D.ex)))); await ready(page);
    await page.click('#tab-design'); await sleep(300);
    await page.locator('#seq .row:not(.cover) .pick').nth(5).click(); await sleep(300);
    rec('9.x malicious title rendered as text in rail and details', await page.evaluate(() => !document.querySelector('#seq img[src="x"]') && document.querySelector('#d-title').textContent.indexOf('<img') === 0));
    await page.click('#tab-write'); await sleep(200);
    rec('9.y write surface shows raw markup text, no element injected', await page.evaluate(() => document.getElementById('w-note').value.indexOf('<script>') > -1 && !document.querySelector('#write script')));
    errsAll.push(...errs.map((e) => 'suite9: ' + e));
    rec('9.z no console errors or alert dialogs across 12 renders', !errs.length, errs.slice(0, 4).join(' / '));
    await ctx.close();
  }

  /* ================= viewports, overlap, radius audit, screenshots ================= */
  {
    const errs = [];
    for (const vp of [[1440, 900], [1280, 800], [1024, 768], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: vp[0] < 500, isMobile: vp[0] < 500 });
      const page = await open(ctx, BASE + '?fresh=1', errs);
      await page.locator('#seq .row:not(.cover) .pick').nth(0).evaluate((b) => b.click());
      await sleep(200);
      for (const m of ['write', 'design', 'preview']) {
        await page.evaluate((m) => document.getElementById('tab-' + m).click(), m); await sleep(m === 'write' ? 200 : 700);
        const r = await page.evaluate(() => {
          const vis = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
          const rail = vis('.rail'), wsp = vis('.wsp'), det = vis('.det');
          const ov = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1;
          const col = document.querySelector('#write .col'), cr = col && getComputedStyle(document.getElementById('write')).display !== 'none' ? col.getBoundingClientRect() : null;
          return { colOff: cr ? (cr.left < -1 || cr.right > innerWidth + 1) : false, wb: document.querySelector('.wbody').scrollLeft + document.querySelector('.wbody').scrollTop, hs: document.documentElement.scrollWidth - innerWidth, overlap: !!(ov(rail, wsp) || ov(wsp, det)), wsp: wsp ? Math.round(wsp.width) : 0, rail: rail ? Math.round(rail.width) : 0, det: det ? Math.round(det.width) : 0 };
        });
        rec(`10 ${vp[0]}x${vp[1]} ${m}: no h-scroll, no overlap (rail ${r.rail} / ws ${r.wsp} / det ${r.det})`, r.hs <= 0 && !r.overlap && !r.colOff && !r.wb, 'colOff=' + r.colOff + ' wbodyScroll=' + r.wb);
        await page.screenshot({ path: path.join(OUT, `v5-${vp[0]}-${m}.png`) });
      }
      if (vp[0] === 1440) {
        /* radius audit across every editor state that has its own elements */
        await page.evaluate(() => document.getElementById('tab-design').click()); await sleep(300);
        const audit = async () => page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].some((k) => parseFloat(c[k]) > 0); }).map((e) => e.tagName + '.' + e.className));
        let bad = await audit();
        await page.locator('#seq .row.cover .pick').click(); await sleep(300); bad = bad.concat(await audit());
        await page.click('#more-btn'); bad = bad.concat(await audit()); await page.keyboard.press('Escape');
        await page.click('.rail [data-act="add"]'); await sleep(200); bad = bad.concat(await audit());
        await page.screenshot({ path: path.join(OUT, 'v5-1440-add-dialog.png') });
        await page.keyboard.press('Escape'); await sleep(100);
        rec('11.1 add dialog: Esc closes and focus returns to opener', await page.evaluate(() => !document.getElementById('add').open && document.activeElement.matches('.rail [data-act="add"]')));
        await page.click('.acts [data-act="save"]'); bad = bad.concat(await audit());
        rec('11.2 editor chrome has no rounded corners (cards, inputs, buttons, menu, dialog, toast)', !bad.length, [...new Set(bad)].slice(0, 6).join(', '));
        rec('11.3 tabs expose aria-selected; handles have labels', await page.evaluate(() => document.querySelector('[role=tab][aria-selected=true]') && [...document.querySelectorAll('.grip[aria-label]')].length === LectaEditor.getData().items.length));
        rec('11.4 no exhibition wording in the editor UI', await page.evaluate(() => !/exhibition/i.test(document.body.innerText)));
        rec('11.5 no middle dots or bullets in the editor UI', await page.evaluate(() => !/[·•]/.test(document.body.innerText)));
      }
      await ctx.close();
    }
    errsAll.push(...errs.map((e) => 'suite10: ' + e));
    rec('10.z no console errors across viewports', !errs.length, errs.slice(0, 3).join(' / '));
  }

  await browser.close();
  const pass = results.filter((r) => r.ok).length;
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ pass, total: results.length, results, errors: errsAll }, null, 2));
  console.log(`\n${pass}/${results.length} passed`);
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(1); });
