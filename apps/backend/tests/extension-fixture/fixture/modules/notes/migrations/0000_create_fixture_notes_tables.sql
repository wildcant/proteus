CREATE TABLE "fixture_notes" (
	"id" text PRIMARY KEY DEFAULT CONCAT('fnote_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"title" text NOT NULL,
	"core_product_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "fixture_notes_core_product_id_idx" ON "fixture_notes" USING btree ("core_product_id") WHERE deleted_at IS NULL;