CREATE TABLE "region_payment_provider" (
	"id" text PRIMARY KEY DEFAULT CONCAT('regpp_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"region_id" text NOT NULL,
	"payment_provider_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_regpp_region_payment_provider" ON "region_payment_provider" USING btree ("region_id","payment_provider_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regpp_region_id" ON "region_payment_provider" USING btree ("region_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_regpp_payment_provider_id" ON "region_payment_provider" USING btree ("payment_provider_id") WHERE deleted_at IS NULL;