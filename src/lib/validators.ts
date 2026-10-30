import { z } from "zod";

export const MEDIA = ["FILM", "SERIES", "BOOK", "ALBUM"] as const;
export const mediumSchema = z.enum(MEDIA);

const id = z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_\-]+$/, "invalid id");
// Plain text only: strip control chars; HTML is never rendered as HTML, but we also refuse obvious markup.
const plain = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .refine((s) => !/<\s*\/?\s*(script|iframe|img|svg|style|a)\b/i.test(s), "markup is not allowed");

export const worksQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  medium: mediumSchema.optional(),
  limit: z.coerce.number().int().min(1).max(60).default(48),
});

export const curatorNoteSchema = z.object({ workId: id, note: plain(200) });

export const createExhibitionSchema = z.object({
  title: plain(80).refine((s) => s.length > 0, "title is required"),
  description: plain(400).optional(),
  workIds: z.array(id).min(2, "add at least 2 works").max(8, "an exhibition starts with at most 8 works"),
  curatorNotes: z.array(curatorNoteSchema).max(8).optional(),
  requestId: z.string().trim().min(6).max(64).regex(/^[A-Za-z0-9_\-:.]+$/).optional(),
});
export type CreateExhibitionInput = z.infer<typeof createExhibitionSchema>;

export const patchExhibitionSchema = z.object({
  title: plain(80).refine((s) => s.length > 0, "title is required").optional(),
  description: plain(400).optional(),
  items: z
    .array(z.object({ workId: id, curatorNote: plain(200).optional() }))
    .min(1)
    .max(16)
    .optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const addItemSchema = z.object({
  workId: id,
  curatorNote: plain(200).optional(),
  fromRecommendation: z.boolean().optional(),
  score: z.number().min(0).max(1).optional(),
});

export const recommendationRequestSchema = z.object({
  exhibitionId: id.optional(),
  seedWorkIds: z.array(id).max(16).optional(),
  collectionTitle: plain(80).optional(),
  description: plain(400).optional(),
  likedReasons: z.array(plain(80)).max(10).optional(),
  targetMedium: mediumSchema.optional(),
  limit: z.number().int().min(1).max(10).default(3),
  excludedWorkIds: z.array(id).max(50).optional(),
});
export type RecommendationRequest = z.input<typeof recommendationRequestSchema>;

export function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
}
