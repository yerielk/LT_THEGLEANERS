import { z } from "zod";

export const TEMPLATES = ["the-spread", "the-edit", "afterimage"] as const;
export const paletteSchema = z.array(z.object({ hex: z.string().regex(/^#[0-9a-f]{6}$/i), weight: z.number().min(0).max(1) })).max(6);
// Never persist executable/data URLs from the prototype. Uploads get an authenticated asset URL.
const imageUrl = z.string().max(2048).refine((s) => /^\/api\/curation-assets\/[a-zA-Z0-9_-]+$/.test(s) || /^https:\/\//i.test(s), "Use an uploaded image or HTTPS image URL");
const image = z.object({ src: imageUrl });
const text = (max: number) => z.string().max(max).default("");
export const curationItemSchema = z.object({
  id: z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/),
  title: text(200), creator: text(300), year: text(20), medium: text(30),
  reason: text(400), note: text(50000),
  layout: z.enum(["", "auto", "page", "inset", "full", "plate", "quote"]).default(""),
  featured: z.boolean().default(false),
  cover: image.nullable().default(null),
  scenes: z.array(image.extend({ caption: text(120), ar: z.number().positive().max(100).nullable().optional() })).max(12).default([]),
  palette: paletteSchema.nullable().default(null),
});
export const curationDocumentSchema = z.object({
  title: z.string().trim().max(120).default(""), subtitle: text(160), curator: text(60), intro: text(50000),
  template: z.enum(TEMPLATES).default("the-spread"),
  accentIndex: z.number().int().min(0).max(100).nullable().default(null),
  heroId: z.string().max(64).optional(),
  items: z.array(curationItemSchema).max(64).refine((items) => new Set(items.map((i) => i.id)).size === items.length, "A work can appear only once"),
});
export type CurationDocument = z.infer<typeof curationDocumentSchema>;
export type CurationItem = CurationDocument["items"][number];
