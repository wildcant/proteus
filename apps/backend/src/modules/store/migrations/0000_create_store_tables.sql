CREATE TABLE "store_currency" (
	"id" text PRIMARY KEY DEFAULT CONCAT('stocur_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"store_id" text NOT NULL,
	"currency_code" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "store" (
	"id" text PRIMARY KEY DEFAULT CONCAT('store_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"default_region_id" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "store_currency" ADD CONSTRAINT "store_currency_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_store_currency_store_id_currency_code" ON "store_currency" USING btree ("store_id","currency_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_store_currency_store_id" ON "store_currency" USING btree ("store_id") WHERE deleted_at IS NULL;