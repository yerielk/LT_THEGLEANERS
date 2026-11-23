import sharp from "sharp";
import paletteEngine from "./palette.cjs";

export type Palette = { hex: string; weight: number }[];

/** The same 4% crop, 72px sample and median-cut engine the templates use in the browser. */
export async function paletteOf(bytes: Uint8Array): Promise<Palette> {
  const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false }).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0, height = meta.height ?? 0;
  if (!width || !height) throw new Error("unreadable image");
  const left = Math.floor(width * 0.04), top = Math.floor(height * 0.04);
  const pixels = await image.extract({ left, top, width: Math.max(1, width - 2 * left), height: Math.max(1, height - 2 * top) })
    .resize({ width: 72, height: 72, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer();
  return paletteEngine.LectaPalette.pack(paletteEngine.LectaPalette.fromPixels(pixels));
}

const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Downloads one artwork image and samples it. Only https, only images, capped in size and time.
 * The URL always comes from our own catalog (a metadata provider's answer), never from a request.
 */
export async function paletteFromUrl(url: string, opts: { fetch?: typeof fetch; timeoutMs?: number } = {}): Promise<Palette | null> {
  if (!/^https:\/\//i.test(url)) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await (opts.fetch ?? fetch)(url, { signal: ctl.signal, redirect: "follow", headers: { Accept: "image/*", "User-Agent": "Lecta/0.1.0 (cover colour sampling)" } });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) return null;
    const palette = await paletteOf(bytes);
    return palette.length ? palette : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
