CREATE TABLE "fulfillment_address" (
	"id" text PRIMARY KEY DEFAULT CONCAT('fuladdr_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"fulfillment_id" text NOT NULL,
	"company" text,
	"first_name" text,
	"last_name" text,
	"address_1" text,
	"address_2" text,
	"city" text,
	"country_code" text,
	"province" text,
	"postal_code" text,
	"phone" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fulfillment_item" (
	"id" text PRIMARY KEY DEFAULT CONCAT('fulit_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"fulfillment_id" text NOT NULL,
	"title" text NOT NULL,
	"quantity" integer NOT NULL,
	"sku" text,
	"barcode" text,
	"line_item_id" text,
	"inventory_item_id" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fulfillment_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fulfillment_set" (
	"id" text PRIMARY KEY DEFAULT CONCAT('fuset_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fulfillment" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ful_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"location_id" text,
	"provider_id" text NOT NULL,
	"shipping_option_id" text,
	"data" jsonb,
	"requires_shipping" boolean DEFAULT true NOT NULL,
	"packed_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "geo_zone" (
	"id" text PRIMARY KEY DEFAULT CONCAT('fgz_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"type" text NOT NULL,
	"country_code" text NOT NULL,
	"province_code" text,
	"city" text,
	"postal_expression" text,
	"service_zone_id" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "service_zone" (
	"id" text PRIMARY KEY DEFAULT CONCAT('serzo_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"fulfillment_set_id" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shipping_option" (
	"id" text PRIMARY KEY DEFAULT CONCAT('so_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"price_type" text NOT NULL,
	"amount" integer,
	"service_zone_id" text NOT NULL,
	"shipping_profile_id" text NOT NULL,
	"shipping_option_type_id" text,
	"provider_id" text NOT NULL,
	"data" jsonb,
	"metadata" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shipping_option_type" (
	"id" text PRIMARY KEY DEFAULT CONCAT('sotype_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shipping_profile" (
	"id" text PRIMARY KEY DEFAULT CONCAT('sp_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fulfillment_address" ADD CONSTRAINT "fulfillment_address_fulfillment_id_fulfillment_id_fk" FOREIGN KEY ("fulfillment_id") REFERENCES "public"."fulfillment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_item" ADD CONSTRAINT "fulfillment_item_fulfillment_id_fulfillment_id_fk" FOREIGN KEY ("fulfillment_id") REFERENCES "public"."fulfillment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment" ADD CONSTRAINT "fulfillment_shipping_option_id_shipping_option_id_fk" FOREIGN KEY ("shipping_option_id") REFERENCES "public"."shipping_option"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_zone" ADD CONSTRAINT "geo_zone_service_zone_id_service_zone_id_fk" FOREIGN KEY ("service_zone_id") REFERENCES "public"."service_zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_zone" ADD CONSTRAINT "service_zone_fulfillment_set_id_fulfillment_set_id_fk" FOREIGN KEY ("fulfillment_set_id") REFERENCES "public"."fulfillment_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_option" ADD CONSTRAINT "shipping_option_service_zone_id_service_zone_id_fk" FOREIGN KEY ("service_zone_id") REFERENCES "public"."service_zone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_option" ADD CONSTRAINT "shipping_option_shipping_profile_id_shipping_profile_id_fk" FOREIGN KEY ("shipping_profile_id") REFERENCES "public"."shipping_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_option" ADD CONSTRAINT "shipping_option_shipping_option_type_id_shipping_option_type_id_fk" FOREIGN KEY ("shipping_option_type_id") REFERENCES "public"."shipping_option_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fulfillment_address_fulfillment_id" ON "fulfillment_address" USING btree ("fulfillment_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_fulfillment_item_fulfillment_id" ON "fulfillment_item" USING btree ("fulfillment_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_fulfillment_set_type" ON "fulfillment_set" USING btree ("type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_fulfillment_provider_id" ON "fulfillment" USING btree ("provider_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_fulfillment_shipping_option_id" ON "fulfillment" USING btree ("shipping_option_id") WHERE shipping_option_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_geo_zone_service_zone_id" ON "geo_zone" USING btree ("service_zone_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_geo_zone_country_code" ON "geo_zone" USING btree ("country_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_service_zone_fulfillment_set_id" ON "service_zone" USING btree ("fulfillment_set_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_shipping_option_service_zone_id" ON "shipping_option" USING btree ("service_zone_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_shipping_option_provider_id" ON "shipping_option" USING btree ("provider_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_shipping_option_profile_id" ON "shipping_option" USING btree ("shipping_profile_id") WHERE deleted_at IS NULL;