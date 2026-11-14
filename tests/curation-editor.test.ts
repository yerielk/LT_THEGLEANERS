import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { code, freshDb, anon, demo, stranger } from "./helpers";
import type { Db } from "../src/lib/db";
import { createCuration, saveCuration, curationView, uploadCurationImage, readCurationImage } from "../src/lib/services/curation-editor";
import { createExhibition, getExhibition, updateExhibition, addItem, listMine } from "../src/lib/services/exhibitions";
import { getWork, searchWorks } from "../src/lib/services/works";
import { curationWork } from "../src/lib/curation/view";
import type { CurationDocument } from "../src/lib/curation/document";

let db: Db;
beforeEach(async () => { db = await freshDb(); });
async function document(): Promise<CurationDocument> {
  return { title: "여운이 남는 장면", subtitle: "11월", curator: "나", intro: "소개\n\n두 번째 문단", template: "the-spread", accentIndex: 1,
    items: await Promise.all(["w_film_aftersun", "w_book_stoner"].map(async (id) => curationWork(await getWork(id, db)))) };
}

describe("service curation editor", () => {
  it("persists ordered works, separate reason/body, template and design metadata across reopen", async () => {
    const d = await document();
    const ex = await createCuration({ document: d, requestId: "editor_roundtrip" }, demo, db);
    d.template = "afterimage";
    d.items.reverse();
    d.items[0].reason = "한 줄 이유";
    d.items[0].note = "긴 감상입니다. ".repeat(300) + "\n\n> 여운\n> 기억\n\n**굵은 글**";
    d.items[0].layout = "quote"; d.items[0].featured = true;
    d.items[0].palette = [{ hex: "#123456", weight: 1 }];
    const result = await saveCuration(ex.id, { document: d, expectedVersion: 1 }, demo, db);
    expect(result.version).toBe(2);
    expect(curationView(await getExhibition(ex.id, demo, db))).toMatchObject(d);
    expect((await listMine(demo, db)).map((x) => x.id)).toContain(ex.id);
    expect(await code(getExhibition(ex.id, anon, db))).toBe("UNAUTHORIZED");
  });
  it("opens legacy/MCP drafts without losing their works and incorporates later recommendation additions", async () => {
    const { exhibition } = await createExhibition({ title: "기존 방", workIds: ["w_film_aftersun", "w_book_stoner"], curatorNotes: [{ workId: "w_book_stoner", note: "원래의 감상" }] }, demo, {}, db);
    const d = curationView(exhibition);
    expect(d.items[1].reason).toBe("원래의 감상");
    await saveCuration(exhibition.id, { document: d, expectedVersion: exhibition.version }, demo, db);
    const added = await addItem(exhibition.id, { workId: "w_album_pink_moon" }, demo, db);
    expect(curationView(added).items.map((x) => x.id)).toEqual(["w_film_aftersun", "w_book_stoner", "w_album_pink_moon"]);
    const edited = await updateExhibition(exhibition.id, { description: "API로 바꾼 소개", items: [{ workId: "w_book_stoner", curatorNote: "바꾼 이유" }], expectedVersion: added.version }, demo, db);
    expect(curationView(edited).intro).toBe("API로 바꾼 소개");
    expect(curationView(edited).items[0].reason).toBe("바꾼 이유");
  });
  it("allows an empty private draft, idempotent creation and removal of the last work", async () => {
    const d = await document(); d.items = [];
    const a = await createCuration({ document: d, requestId: "editor_empty" }, demo, db);
    const b = await createCuration({ document: d, requestId: "editor_empty" }, demo, db);
    expect(a.id).toBe(b.id); expect(a.items).toHaveLength(0);
    d.items = (await document()).items;
    const filled = await saveCuration(a.id, { document: d, expectedVersion: a.version }, demo, db);
    d.items = [];
    const emptied = await saveCuration(a.id, { document: d, expectedVersion: filled.version }, demo, db);
    expect(emptied.items).toHaveLength(0);
    const pool = (await searchWorks({ limit: 20 }, db)).works;
    d.items = pool.slice(0, 17).map(curationWork);
    await saveCuration(a.id, { document: d, expectedVersion: emptied.version }, demo, db);
    expect((await addItem(a.id, { workId: pool[17].id }, demo, db)).items).toHaveLength(18);
  });
  it("rejects unauthenticated/cross-user writes and atomically rejects concurrent stale saves", async () => {
    const d = await document();
    expect(await code(createCuration({ document: d, requestId: "editor_no_auth" }, anon, db))).toBe("UNAUTHORIZED");
    const ex = await createCuration({ document: d, requestId: "editor_conflict" }, demo, db);
    expect(await code(saveCuration(ex.id, { document: d, expectedVersion: 1 }, stranger, db))).toBe("FORBIDDEN");
    const results = await Promise.all([code(saveCuration(ex.id, { document: { ...d, title: "A" }, expectedVersion: 1 }, demo, db)), code(saveCuration(ex.id, { document: { ...d, title: "B" }, expectedVersion: 1 }, demo, db))]);
    expect(results.sort()).toEqual(["CONFLICT", "NO_ERROR"]);
    expect((await getExhibition(ex.id, demo, db)).version).toBe(2);
  });
  it("rejects invented/duplicate works and executable images; escapes text in templates instead of executing it", async () => {
    const d = await document();
    const ex = await createCuration({ document: d, requestId: "editor_validation" }, demo, db);
    const save = (doc: CurationDocument) => code(saveCuration(ex.id, { document: doc, expectedVersion: 1 }, demo, db));
    expect(await save({ ...d, items: [d.items[0], d.items[0]] })).toBe("VALIDATION_ERROR");
    expect(await save({ ...d, items: [{ ...d.items[0], id: "w_invented" }] })).toBe("WORK_NOT_FOUND");
    expect(await save({ ...d, items: [{ ...d.items[0], cover: { src: "javascript:alert(1)" } }] })).toBe("VALIDATION_ERROR");
    const edited = await saveCuration(ex.id, { document: { ...d, items: [{ ...d.items[0], title: "fake metadata", note: "<script>alert(1)</script>" }] }, expectedVersion: 1 }, demo, db);
    expect(curationView(edited).items[0].title).toBe("Aftersun");
    expect(curationView(edited).items[0].note).toBe("<script>alert(1)</script>");
  });
  it("stores re-encoded images and server palettes durably, enforcing draft and attachment ownership", async () => {
    const d = await document(); d.items[0].cover = null;
    const ex = await createCuration({ document: d, requestId: "editor_images" }, demo, db);
    const png = await sharp({ create: { width: 30, height: 60, channels: 4, background: "#263b84" } }).png().toBuffer();
    expect(await code(uploadCurationImage(ex.id, png, stranger, db))).toBe("FORBIDDEN");
    expect(await code(uploadCurationImage(ex.id, Buffer.from('<svg onload="alert(1)"/>'), demo, db))).toBe("VALIDATION_ERROR");
    const image = await uploadCurationImage(ex.id, png, demo, db);
    expect(image.palette.length).toBeGreaterThan(0); expect(image.ar).toBe(.5);
    const imageId = image.src.split("/").at(-1)!;
    expect((await readCurationImage(imageId, demo, db)).mime).toBe("image/webp");
    expect(await code(readCurationImage(imageId, anon, db))).toBe("UNAUTHORIZED");
    d.items[0].scenes = [{ src: image.src, ar: image.ar, caption: "세로 장면" }];
    const saved = await saveCuration(ex.id, { document: d, expectedVersion: 1 }, demo, db);
    expect(curationView(saved).items[0].palette).toEqual(image.palette);
    const other = await createCuration({ document: await document(), requestId: "editor_other_assets" }, demo, db);
    expect(await code(saveCuration(other.id, { document: d, expectedVersion: 1 }, demo, db))).toBe("FORBIDDEN");
  });
});
