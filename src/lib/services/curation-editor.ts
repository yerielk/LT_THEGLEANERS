import { and, count, eq, inArray, max, sql } from "drizzle-orm";
import { z } from "zod";
import sharp from "sharp";
import { getDb, newId, type Db } from "../db";
import { curationAssets, exhibitionItems, exhibitions, tasteSignals } from "../schema";
import { curationDocumentSchema, type CurationDocument } from "../curation/document";
import { curationView, curationWork } from "../curation/view";
import paletteEngine from "../curation/palette.cjs";
import { zodMessage } from "../validators";
import { getExhibition, recordCurationSignals } from "./exhibitions";
import { getWorksByIds } from "./works";
import { LectaError } from "./errors";
import type { Actor } from "./actor";

const saveSchema = z.object({ document: curationDocumentSchema, expectedVersion: z.number().int().positive() });
const createSchema = z.object({ document: curationDocumentSchema, requestId: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/) });

async function canonicalize(document: CurationDocument, db: Db, exhibitionId?: string): Promise<CurationDocument> {
  const catalog = await getWorksByIds(document.items.map((item) => item.id), db);
  if (catalog.length !== document.items.length) throw new LectaError("WORK_NOT_FOUND", "선택한 작품을 찾을 수 없어요. 작품 검색에서 다시 선택해 주세요.");
  const assetIds = [...new Set(document.items.flatMap((i) => [i.cover?.src, ...i.scenes.map((s) => s.src)])
    .filter((s): s is string => !!s && s.startsWith("/api/curation-assets/")).map((s) => s.split("/").at(-1)!))];
  const assets = assetIds.length ? await db.select({ id: curationAssets.id, exhibitionId: curationAssets.exhibitionId, palette: curationAssets.palette }).from(curationAssets).where(inArray(curationAssets.id, assetIds)) : [];
  if (assetIds.some((id) => !assets.some((a) => a.id === id && a.exhibitionId === exhibitionId))) {
    throw new LectaError("FORBIDDEN", "다른 큐레이션의 업로드 이미지를 사용할 수 없어요.");
  }
  const byId = new Map(catalog.map((work) => [work.id, work]));
  return { ...document, title: document.title || "Untitled", heroId: document.items[0]?.id,
    items: document.items.map((item) => {
      const canonical = curationWork(byId.get(item.id)!);
      const colorSource = item.cover?.src || item.scenes[0]?.src;
      const uploaded = assets.find((a) => colorSource === `/api/curation-assets/${a.id}`);
      return { ...item, title: canonical.title, creator: canonical.creator, year: canonical.year, medium: canonical.medium,
        palette: uploaded?.palette ?? item.palette };
    }),
  };
}

export async function createCuration(input: unknown, actor: Actor, db: Db = getDb()) {
  if (!actor.userId) throw new LectaError("UNAUTHORIZED", "로그인하면 큐레이션을 저장할 수 있어요.");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const { requestId } = parsed.data;
  const [prior] = await db.select({ id: exhibitions.id }).from(exhibitions).where(and(eq(exhibitions.ownerId, actor.userId), eq(exhibitions.requestKey, requestId)));
  if (prior) return getExhibition(prior.id, actor, db);
  const document = await canonicalize(parsed.data.document, db);
  const id = newId("ex");
  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: max(exhibitions.number) }).from(exhibitions);
    const inserted = await tx.insert(exhibitions).values({ id, ownerId: actor.userId!, title: document.title,
      description: document.intro.slice(0, 400) || null, visibility: "DRAFT", number: (n ?? 0) + 1,
      requestKey: requestId, layoutTemplate: document.template, curationData: document }).onConflictDoNothing().returning({ id: exhibitions.id });
    if (inserted.length && document.items.length) await tx.insert(exhibitionItems).values(document.items.map((item, position) => ({
      id: newId("exi"), exhibitionId: id, workId: item.id, position, curatorNote: item.reason || null,
    })));
    if (inserted.length) await recordCurationSignals(tx, actor.userId!, id, document.items.map((item) => ({ workId: item.id, note: item.reason || null })), "USER_EXPLICIT");
  });
  const [saved] = await db.select({ id: exhibitions.id }).from(exhibitions).where(and(eq(exhibitions.ownerId, actor.userId), eq(exhibitions.requestKey, requestId)));
  return getExhibition(saved.id, actor, db);
}

export async function saveCuration(id: string, input: unknown, actor: Actor, db: Db = getDb()) {
  if (!actor.userId) throw new LectaError("UNAUTHORIZED", "로그인하면 큐레이션을 저장할 수 있어요.");
  const current = await getExhibition(id, actor, db);
  if (!current.isOwner) throw new LectaError("FORBIDDEN", "만든 사람만 큐레이션을 수정할 수 있어요.");
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) throw new LectaError("VALIDATION_ERROR", zodMessage(parsed.error));
  const document = await canonicalize(parsed.data.document, db, id);
  await db.transaction(async (tx) => {
    // Compare-and-swap in SQL, rather than a check before the transaction: two tabs cannot overwrite each other.
    const rows = await tx.update(exhibitions).set({ title: document.title, description: document.intro.slice(0, 400) || null,
      layoutTemplate: document.template, curationData: document, version: sql`${exhibitions.version} + 1`, updatedAt: new Date() })
      .where(and(eq(exhibitions.id, id), eq(exhibitions.ownerId, actor.userId!), eq(exhibitions.version, parsed.data.expectedVersion))).returning({ id: exhibitions.id });
    if (!rows.length) throw new LectaError("CONFLICT", "다른 창에서 수정했어요. 글을 JSON으로 내려받은 뒤 새로고침해 주세요.");
    await tx.delete(exhibitionItems).where(eq(exhibitionItems.exhibitionId, id));
    if (document.items.length) await tx.insert(exhibitionItems).values(document.items.map((item, position) => ({
      id: newId("exi"), exhibitionId: id, workId: item.id, position, curatorNote: item.reason || null,
    })));
    await tx.delete(tasteSignals).where(and(eq(tasteSignals.exhibitionId, id), eq(tasteSignals.signalType, "CURATED")));
    await recordCurationSignals(tx, actor.userId!, id, document.items.map((item) => ({ workId: item.id, note: item.reason || null })), "USER_EXPLICIT");
  });
  return getExhibition(id, actor, db);
}

export async function uploadCurationImage(id: string, bytes: Uint8Array, actor: Actor, db: Db = getDb()) {
  const ex = await getExhibition(id, actor, db);
  if (!ex.isOwner) throw new LectaError("FORBIDDEN", "만든 사람만 이미지를 올릴 수 있어요.");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new LectaError("VALIDATION_ERROR", "이미지는 8MB 이하로 올려 주세요.");
  const [{ n }] = await db.select({ n: count() }).from(curationAssets).where(eq(curationAssets.exhibitionId, id));
  if (n >= 200) throw new LectaError("VALIDATION_ERROR", "이 큐레이션에는 이미지를 200개까지 올릴 수 있어요.");
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format)) throw new Error("unsupported format");
    const { data, info } = await image.rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
    // Same 4% crop, 72px sample and median-cut engine used by the approved templates.
    const left = Math.floor(info.width * .04), top = Math.floor(info.height * .04);
    const pixels = await sharp(data).extract({ left, top, width: Math.max(1, info.width - 2 * left), height: Math.max(1, info.height - 2 * top) })
      .resize({ width: 72, height: 72, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer();
    const palette = paletteEngine.LectaPalette.pack(paletteEngine.LectaPalette.fromPixels(pixels));
    const assetId = newId("img");
    await db.insert(curationAssets).values({ id: assetId, exhibitionId: id, data: data.toString("base64"), mime: "image/webp", palette });
    return { src: `/api/curation-assets/${assetId}`, ar: info.width / info.height, palette };
  } catch (e) {
    if (e instanceof LectaError) throw e;
    throw new LectaError("VALIDATION_ERROR", "이미지를 읽을 수 없어요. JPEG·PNG·WebP·AVIF 파일을 골라 주세요.");
  }
}

export async function readCurationImage(id: string, actor: Actor, db: Db = getDb()) {
  const [asset] = await db.select().from(curationAssets).where(eq(curationAssets.id, id));
  if (!asset) throw new LectaError("WORK_NOT_FOUND", "이미지를 찾을 수 없어요.");
  await getExhibition(asset.exhibitionId, actor, db);
  return { bytes: Buffer.from(asset.data, "base64"), mime: asset.mime };
}

export { curationView };
