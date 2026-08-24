CREATE TYPE "public"."product_option_render_as" AS ENUM('text', 'swatch');--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" text PRIMARY KEY DEFAULT CONCAT('img_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"product_id" text NOT NULL,
	"url" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_option" (
	"id" text PRIMARY KEY DEFAULT CONCAT('opt_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"title" text NOT NULL,
	"render_as" "product_option_render_as" DEFAULT 'text' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_option_value" (
	"id" text PRIMARY KEY DEFAULT CONCAT('optval_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"option_id" text NOT NULL,
	"value" text NOT NULL,
	"rank" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_product_option" (
	"id" text PRIMARY KEY DEFAULT CONCAT('prodopt_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"product_id" text NOT NULL,
	"option_id" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_product_option_value" (
	"id" text PRIMARY KEY DEFAULT CONCAT('prodoptval_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"product_product_option_id" text NOT NULL,
	"option_value_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY DEFAULT CONCAT('prod_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"subtitle" text,
	"description" text,
	"is_giftcard" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"thumbnail" text,
	"weight" double precision,
	"length" double precision,
	"height" double precision,
	"width" double precision,
	"origin_country" text,
	"hs_code" text,
	"mid_code" text,
	"material" text,
	"discountable" boolean DEFAULT true NOT NULL,
	"external_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_variant_image" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pvimg_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"variant_id" text NOT NULL,
	"image_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_variant_option" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pvopt_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"variant_id" text NOT NULL,
	"option_id" text NOT NULL,
	"option_value_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" text PRIMARY KEY DEFAULT CONCAT('variant_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"product_id" text NOT NULL,
	"title" text NOT NULL,
	"thumbnail" text,
	"sku" text,
	"barcode" text,
	"ean" text,
	"upc" text,
	"allow_backorder" boolean DEFAULT false NOT NULL,
	"manage_inventory" boolean DEFAULT true NOT NULL,
	"hs_code" text,
	"origin_country" text,
	"mid_code" text,
	"material" text,
	"weight" double precision,
	"length" double precision,
	"height" double precision,
	"width" double precision,
	"variant_rank" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_value" ADD CONSTRAINT "product_option_value_option_id_product_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_option" ADD CONSTRAINT "product_product_option_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_option" ADD CONSTRAINT "product_product_option_option_id_product_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_option"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_option_value" ADD CONSTRAINT "product_product_option_value_product_product_option_id_product_product_option_id_fk" FOREIGN KEY ("product_product_option_id") REFERENCES "public"."product_product_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_option_value" ADD CONSTRAINT "product_product_option_value_option_value_id_product_option_value_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."product_option_value"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_image" ADD CONSTRAINT "product_variant_image_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_image" ADD CONSTRAINT "product_variant_image_image_id_product_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."product_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option" ADD CONSTRAINT "product_variant_option_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option" ADD CONSTRAINT "product_variant_option_option_id_product_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option" ADD CONSTRAINT "product_variant_option_option_value_id_product_option_value_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."product_option_value"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_image_product_id" ON "product_image" USING btree ("product_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_image_url" ON "product_image" USING btree ("url") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_image_rank_product_id" ON "product_image" USING btree ("rank","product_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_option_title" ON "product_option" USING btree ("title") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_option_value_option_id" ON "product_option_value" USING btree ("option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_option_value_option_id_value" ON "product_option_value" USING btree ("option_id","value") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_option_product_id" ON "product_product_option" USING btree ("product_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_option_option_id" ON "product_product_option" USING btree ("option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_product_option_product_option" ON "product_product_option" USING btree ("product_id","option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_option_value_ppo_id" ON "product_product_option_value" USING btree ("product_product_option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_option_value_ov_id" ON "product_product_option_value" USING btree ("option_value_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_product_option_value_ppo_ov" ON "product_product_option_value" USING btree ("product_product_option_id","option_value_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_handle" ON "product" USING btree ("handle") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_image_variant_id" ON "product_variant_image" USING btree ("variant_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_image_image_id" ON "product_variant_image" USING btree ("image_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_image_variant_id_image_id" ON "product_variant_image" USING btree ("variant_id","image_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_option_variant_id" ON "product_variant_option" USING btree ("variant_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_option_option_id" ON "product_variant_option" USING btree ("option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_option_option_value_id" ON "product_variant_option" USING btree ("option_value_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_option_variant_option" ON "product_variant_option" USING btree ("variant_id","option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_option_variant_option_value" ON "product_variant_option" USING btree ("variant_id","option_value_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_product_id" ON "product_variant" USING btree ("product_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_sku" ON "product_variant" USING btree ("sku") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_barcode" ON "product_variant" USING btree ("barcode") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_ean" ON "product_variant" USING btree ("ean") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_upc" ON "product_variant" USING btree ("upc") WHERE deleted_at IS NULL;