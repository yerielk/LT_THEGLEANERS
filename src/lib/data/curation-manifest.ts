import { z } from "zod";

const workReference = z.object({
  id: z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  medium: z.enum(["FILM", "SERIES", "BOOK", "ALBUM", "TRACK", "PERFORMANCE", "EXHIBITION"]),
  creator: z.string().max(200),
});

const curation = z.object({
  id: z.string().regex(/^ex_blog_[a-z0-9]+(?:_[a-z0-9]+)*$/),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
  works: z.array(workReference).min(2).max(16),
}).superRefine((entry, ctx) => {
  const ids = new Set(entry.works.map((work) => work.id));
  if (ids.size !== entry.works.length) ctx.addIssue({ code: "custom", message: "duplicate curation work id" });
});

const tagEvidence = z.object({
  work: workReference,
  tagKey: z.string().regex(/^[a-z0-9_]+$/),
  weight: z.number().min(0.1).max(1),
  rationale: z.string().min(12).max(200),
});

export const curationManifestSchema = z.object({
  version: z.literal(1),
  curations: z.array(curation),
  tagEvidence: z.array(tagEvidence),
}).superRefine((manifest, ctx) => {
  const curationIds = new Set(manifest.curations.map((item) => item.id));
  if (curationIds.size !== manifest.curations.length) ctx.addIssue({ code: "custom", path: ["curations"], message: "duplicate curation id" });
  const tagIds = manifest.tagEvidence.map((item) => `${item.work.id}\n${item.tagKey}`);
  if (new Set(tagIds).size !== tagIds.length) ctx.addIssue({ code: "custom", path: ["tagEvidence"], message: "duplicate work/tag evidence" });
});

export type CurationManifest = z.infer<typeof curationManifestSchema>;
