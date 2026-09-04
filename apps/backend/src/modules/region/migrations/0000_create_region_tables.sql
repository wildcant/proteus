CREATE TABLE "country" (
	"id" text PRIMARY KEY NOT NULL,
	"iso3" text NOT NULL,
	"numeric_code" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"region_id" text,
	"locale_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "region" (
	"id" text PRIMARY KEY DEFAULT CONCAT('reg_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"currency_code" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "country" ADD CONSTRAINT "country_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_country_region_id_iso2" ON "country" USING btree ("region_id","id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_country_region_id" ON "country" USING btree ("region_id") WHERE deleted_at IS NULL;