CREATE TABLE "price_set" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pset_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price" (
	"id" text PRIMARY KEY DEFAULT CONCAT('price_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"currency_code" text NOT NULL,
	"amount" numeric NOT NULL,
	"price_set_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_price_set_id_price_set_id_fk" FOREIGN KEY ("price_set_id") REFERENCES "public"."price_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_price_price_set_id" ON "price" USING btree ("price_set_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_price_currency_code" ON "price" USING btree ("currency_code") WHERE deleted_at IS NULL;