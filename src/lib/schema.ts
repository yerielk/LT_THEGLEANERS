/**
 * Lecta schema (PostgreSQL, Drizzle). Migrations are generated into ./drizzle with `npm run db:generate`.
 *
 * `user`, `session`, `account` and `verification` are the Better Auth tables: the JS property names are the
 * field names Better Auth expects, the SQL column names are snake_case.
 */
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ── auth (Better Auth) ────────────────────────────────────────────────────
export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isEditorial: boolean("is_editorial").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const session = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const account = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("accounts_user_idx").on(t.userId)]);

export const verification = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Personal MCP keys. Only a SHA-256 hash is stored; the key is shown once when it is issued. */
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastUsedAt: ts("last_used_at"),
  revokedAt: ts("revoked_at"),
}, (t) => [index("api_keys_user_idx").on(t.userId)]);

// ── catalog ───────────────────────────────────────────────────────────────
export const mediumEnum = pgEnum("medium", ["FILM", "SERIES", "BOOK", "ALBUM"]);
export const metadataStatusEnum = pgEnum("metadata_status", ["VERIFIED", "CURATED", "INCOMPLETE"]);
export const tagCategoryEnum = pgEnum("tag_category", ["MOOD", "THEME", "AESTHETIC", "NARRATIVE", "PACE"]);
export const tagProvenanceEnum = pgEnum("tag_provenance", ["HUMAN_CURATED", "EXTERNAL", "LLM_SUGGESTED"]);

export const works = pgTable("works", {
  id: text("id").primaryKey(),
  medium: mediumEnum("medium").notNull(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  creator: text("creator").notNull(),
  releaseYear: integer("release_year"),
  synopsis: text("synopsis"),
  artworkUrl: text("artwork_url"),
  artworkSource: text("artwork_source"),
  artworkLicenseNote: text("artwork_license_note"),
  externalSource: text("external_source"),
  externalId: text("external_id"),
  sourceUrl: text("source_url"),
  metadataStatus: metadataStatusEnum("metadata_status").notNull(),
  coverTone: text("cover_tone"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("works_external_uq").on(t.externalSource, t.externalId).where(sql`${t.externalId} IS NOT NULL`),
  index("works_medium_idx").on(t.medium),
]);

export const workTags = pgTable("work_tags", {
  id: text("id").primaryKey(),
  workId: text("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
  tagKey: text("tag_key").notNull(),
  category: tagCategoryEnum("category").notNull(),
  weight: real("weight").notNull(),
  provenance: tagProvenanceEnum("provenance").notNull(),
  evidenceText: text("evidence_text"),
  reviewed: boolean("reviewed").notNull().default(false),
}, (t) => [uniqueIndex("work_tags_uq").on(t.workId, t.tagKey)]);

// ── exhibitions ───────────────────────────────────────────────────────────
export const visibilityEnum = pgEnum("visibility", ["DRAFT", "PRIVATE", "PUBLIC"]);

export const exhibitions = pgTable("exhibitions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  slug: text("slug").unique(),
  title: text("title").notNull(),
  description: text("description"),
  visibility: visibilityEnum("visibility").notNull(),
  layoutTemplate: text("layout_template").notNull().default("EDITORIAL_01"),
  isEditorial: boolean("is_editorial").notNull().default(false),
  number: integer("number").notNull(),
  requestKey: text("request_key"),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("exhibitions_request_uq").on(t.ownerId, t.requestKey).where(sql`${t.requestKey} IS NOT NULL`),
  index("exhibitions_owner_idx").on(t.ownerId),
]);

export const exhibitionItems = pgTable("exhibition_items", {
  id: text("id").primaryKey(),
  exhibitionId: text("exhibition_id").notNull().references(() => exhibitions.id, { onDelete: "cascade" }),
  workId: text("work_id").notNull().references(() => works.id),
  position: integer("position").notNull(),
  curatorNote: text("curator_note"),
  visualVariant: text("visual_variant"),
}, (t) => [
  uniqueIndex("exhibition_items_uq").on(t.exhibitionId, t.workId),
  index("exhibition_items_pos_idx").on(t.exhibitionId, t.position),
]);

// ── signals and logs ──────────────────────────────────────────────────────
export const signalTypeEnum = pgEnum("signal_type", ["SAVED", "LIKED", "DISLIKED", "CURATED", "RECOMMENDATION_ADDED"]);
export const signalOriginEnum = pgEnum("signal_origin", ["USER_EXPLICIT", "MODEL_SUGGESTED", "CURATORIAL"]);
export const recActionEnum = pgEnum("rec_action", ["EXPOSED", "CLICKED", "ADDED", "DISMISSED"]);

export const tasteSignals = pgTable("taste_signals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  workId: text("work_id").references(() => works.id),
  exhibitionId: text("exhibition_id").references(() => exhibitions.id, { onDelete: "cascade" }),
  signalType: signalTypeEnum("signal_type").notNull(),
  whyText: text("why_text"),
  structuredTags: jsonb("structured_tags").$type<string[]>(),
  origin: signalOriginEnum("origin").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const recommendationEvents = pgTable("recommendation_events", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  exhibitionId: text("exhibition_id"),
  seedWorkIds: jsonb("seed_work_ids").$type<string[]>().notNull(),
  candidateWorkId: text("candidate_work_id").notNull(),
  score: real("score").notNull(),
  scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number | null>>().notNull(),
  modelVersion: text("model_version").notNull(),
  action: recActionEnum("action").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const agentActivity = pgTable("agent_activity", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  toolName: text("tool_name").notNull(),
  requestId: text("request_id"),
  targetType: text("target_type"),
  targetId: text("target_id"),
  status: text("status").notNull(),
  durationMs: integer("duration_ms"),
  safeSummary: jsonb("safe_summary"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("agent_activity_created_idx").on(t.createdAt)]);
