CREATE TYPE "public"."medium" AS ENUM('FILM', 'SERIES', 'BOOK', 'ALBUM');--> statement-breakpoint
CREATE TYPE "public"."metadata_status" AS ENUM('VERIFIED', 'CURATED', 'INCOMPLETE');--> statement-breakpoint
CREATE TYPE "public"."rec_action" AS ENUM('EXPOSED', 'CLICKED', 'ADDED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."signal_origin" AS ENUM('USER_EXPLICIT', 'MODEL_SUGGESTED', 'CURATORIAL');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('SAVED', 'LIKED', 'DISLIKED', 'CURATED', 'RECOMMENDATION_ADDED');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('MOOD', 'THEME', 'AESTHETIC', 'NARRATIVE', 'PACE');--> statement-breakpoint
CREATE TYPE "public"."tag_provenance" AS ENUM('HUMAN_CURATED', 'EXTERNAL', 'LLM_SUGGESTED');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('DRAFT', 'PRIVATE', 'PUBLIC');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"tool_name" text NOT NULL,
	"request_id" text,
	"target_type" text,
	"target_id" text,
	"status" text NOT NULL,
	"duration_ms" integer,
	"safe_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "exhibition_items" (
	"id" text PRIMARY KEY NOT NULL,
	"exhibition_id" text NOT NULL,
	"work_id" text NOT NULL,
	"position" integer NOT NULL,
	"curator_note" text,
	"visual_variant" text
);
--> statement-breakpoint
CREATE TABLE "exhibitions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"slug" text,
	"title" text NOT NULL,
	"description" text,
	"visibility" "visibility" NOT NULL,
	"layout_template" text DEFAULT 'EDITORIAL_01' NOT NULL,
	"is_editorial" boolean DEFAULT false NOT NULL,
	"number" integer NOT NULL,
	"request_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exhibitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recommendation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"exhibition_id" text,
	"seed_work_ids" jsonb NOT NULL,
	"candidate_work_id" text NOT NULL,
	"score" real NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"model_version" text NOT NULL,
	"action" "rec_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "taste_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"work_id" text,
	"exhibition_id" text,
	"signal_type" "signal_type" NOT NULL,
	"why_text" text,
	"structured_tags" jsonb,
	"origin" "signal_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_editorial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"tag_key" text NOT NULL,
	"category" "tag_category" NOT NULL,
	"weight" real NOT NULL,
	"provenance" "tag_provenance" NOT NULL,
	"evidence_text" text,
	"reviewed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" text PRIMARY KEY NOT NULL,
	"medium" "medium" NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"creator" text NOT NULL,
	"release_year" integer,
	"synopsis" text,
	"artwork_url" text,
	"artwork_source" text,
	"artwork_license_note" text,
	"external_source" text,
	"external_id" text,
	"source_url" text,
	"metadata_status" "metadata_status" NOT NULL,
	"cover_tone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibition_items" ADD CONSTRAINT "exhibition_items_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibition_items" ADD CONSTRAINT "exhibition_items_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_signals" ADD CONSTRAINT "taste_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_signals" ADD CONSTRAINT "taste_signals_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_signals" ADD CONSTRAINT "taste_signals_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_tags" ADD CONSTRAINT "work_tags_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_activity_created_idx" ON "agent_activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exhibition_items_uq" ON "exhibition_items" USING btree ("exhibition_id","work_id");--> statement-breakpoint
CREATE INDEX "exhibition_items_pos_idx" ON "exhibition_items" USING btree ("exhibition_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "exhibitions_request_uq" ON "exhibitions" USING btree ("owner_id","request_key") WHERE "exhibitions"."request_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "exhibitions_owner_idx" ON "exhibitions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_tags_uq" ON "work_tags" USING btree ("work_id","tag_key");--> statement-breakpoint
CREATE UNIQUE INDEX "works_external_uq" ON "works" USING btree ("external_source","external_id") WHERE "works"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "works_medium_idx" ON "works" USING btree ("medium");