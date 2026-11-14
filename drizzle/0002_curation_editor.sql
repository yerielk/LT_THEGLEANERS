CREATE TABLE "curation_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"exhibition_id" text NOT NULL,
	"data" text NOT NULL,
	"mime" text NOT NULL,
	"palette" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "curation_data" jsonb;--> statement-breakpoint
ALTER TABLE "curation_assets" ADD CONSTRAINT "curation_assets_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "curation_assets_exhibition_idx" ON "curation_assets" USING btree ("exhibition_id");