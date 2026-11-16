import { z } from "zod";

const workReference = z.object({
  id: z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  medium: z.enum(["FILM", "SERIES", "BOOK", "ALBUM", "TRACK", "PERFORMANCE", "EXHIBITION"]),
  creator: z.string().max(200),
});
// A curation's own words about a work: one line of why, then the longer note.
const curatedWork = workReference.extend({ reason: z.string().max(400).default(""), note: z.string().max(4000).default("") });

const curation = z.object({
  id: z.string().regex(/^ex_blog_[a-z0-9]+(?:_[a-z0-9]+)*$/),
  title: z.string().min(1).max(80),
  subtitle: z.string().max(160).default(""),
  curator: z.string().min(1).max(60),
  template: z.enum(["the-spread", "the-edit", "afterimage"]),
  description: z.string().min(1).max(400),
  works: z.array(curatedWork).min(2).max(16),
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
  version: z.literal(2),
  curations: z.array(curation),
  tagEvidence: z.array(tagEvidence),
}).superRefine((manifest, ctx) => {
  const curationIds = new Set(manifest.curations.map((item) => item.id));
  if (curationIds.size !== manifest.curations.length) ctx.addIssue({ code: "custom", path: ["curations"], message: "duplicate curation id" });
  const tagIds = manifest.tagEvidence.map((item) => `${item.work.id}\n${item.tagKey}`);
  if (new Set(tagIds).size !== tagIds.length) ctx.addIssue({ code: "custom", path: ["tagEvidence"], message: "duplicate work/tag evidence" });
});

export type CurationManifest = z.infer<typeof curationManifestSchema>;
