ALTER TYPE "public"."medium" ADD VALUE 'TRACK';--> statement-breakpoint
ALTER TYPE "public"."medium" ADD VALUE 'PERFORMANCE';--> statement-breakpoint
ALTER TYPE "public"."medium" ADD VALUE 'EXHIBITION';--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "license" text;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "metadata_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "metadata_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "event" jsonb;--> statement-breakpoint
CREATE INDEX "works_expires_idx" ON "works" USING btree ("metadata_expires_at");