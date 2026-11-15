CREATE TABLE "fixture_shipping_rates" (
	"id" text PRIMARY KEY DEFAULT CONCAT('fsrate_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"city" text NOT NULL,
	"base_amount" integer NOT NULL,
	"per_item_amount" integer NOT NULL,
	"delivery_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "fixture_shipping_rates_city_idx" ON "fixture_shipping_rates" USING btree ("city") WHERE deleted_at IS NULL;