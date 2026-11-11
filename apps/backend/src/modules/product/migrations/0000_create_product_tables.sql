CREATE TYPE "public"."product_option_render_as" AS ENUM('text', 'swatch');--> statement-breakpoint
CREATE TABLE "product_category" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pcat_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"handle" text NOT NULL,
	"parent_id" text,
	"rank" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_collection" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pcol_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"thumbnail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
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
CREATE TABLE "product_import" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pimp_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"file_id" text NOT NULL,
	"options" jsonb NOT NULL,
	"status" text NOT NULL,
	"summary" jsonb NOT NULL,
	"chunks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
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
CREATE TABLE "product_product_category" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ppcat_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"product_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_product_collection" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ppcol_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"product_id" text NOT NULL,
	"collection_id" text NOT NULL,
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
CREATE TABLE "product_product_tag" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pptag_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"product_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_tag" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ptag_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_type" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ptyp_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"value" text NOT NULL,
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
	"product_product_option_value_id" text NOT NULL,
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
	"type_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_id_product_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option_value" ADD CONSTRAINT "product_option_value_option_id_product_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_category" ADD CONSTRAINT "product_product_category_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_category" ADD CONSTRAINT "product_product_category_category_id_product_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_collection" ADD CONSTRAINT "product_product_collection_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_collection" ADD CONSTRAINT "product_product_collection_collection_id_product_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."product_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_option_value" ADD CONSTRAINT "product_product_option_value_product_product_option_id_product_product_option_id_fk" FOREIGN KEY ("product_product_option_id") REFERENCES "public"."product_product_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_option_value" ADD CONSTRAINT "product_product_option_value_option_value_id_product_option_value_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."product_option_value"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_option" ADD CONSTRAINT "product_product_option_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_option" ADD CONSTRAINT "product_product_option_option_id_product_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."product_option"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_tag" ADD CONSTRAINT "product_product_tag_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_product_tag" ADD CONSTRAINT "product_product_tag_tag_id_product_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."product_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_image" ADD CONSTRAINT "product_variant_image_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_image" ADD CONSTRAINT "product_variant_image_image_id_product_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."product_image"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option" ADD CONSTRAINT "product_variant_option_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option" ADD CONSTRAINT "product_variant_option_product_product_option_value_id_product_product_option_value_id_fk" FOREIGN KEY ("product_product_option_value_id") REFERENCES "public"."product_product_option_value"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_type_id_product_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."product_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_category_handle" ON "product_category" USING btree ("handle") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_category_parent_id_rank" ON "product_category" USING btree ("parent_id","rank") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_collection_handle" ON "product_collection" USING btree ("handle") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_image_product_id" ON "product_image" USING btree ("product_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_image_url" ON "product_image" USING btree ("url") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_image_rank_product_id" ON "product_image" USING btree ("rank","product_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_import_status_created_at" ON "product_import" USING btree ("status","created_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_option_value_option_id" ON "product_option_value" USING btree ("option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_option_value_option_id_value" ON "product_option_value" USING btree ("option_id","value") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_option_title" ON "product_option" USING btree ("title") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_product_category_product_category" ON "product_product_category" USING btree ("product_id","category_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_category_category_id" ON "product_product_category" USING btree ("category_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_product_collection_product_collection" ON "product_product_collection" USING btree ("product_id","collection_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_collection_collection_id" ON "product_product_collection" USING btree ("collection_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_option_value_product_product_option_id" ON "product_product_option_value" USING btree ("product_product_option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_option_value_option_value_id" ON "product_product_option_value" USING btree ("option_value_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_product_option_value_value_once_per_option" ON "product_product_option_value" USING btree ("product_product_option_id","option_value_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_option_product_id" ON "product_product_option" USING btree ("product_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_option_option_id" ON "product_product_option" USING btree ("option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_product_option_product_option" ON "product_product_option" USING btree ("product_id","option_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_product_tag_product_tag" ON "product_product_tag" USING btree ("product_id","tag_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_product_tag_tag_id" ON "product_product_tag" USING btree ("tag_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_tag_value" ON "product_tag" USING btree ("value") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_type_value" ON "product_type" USING btree ("value") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_image_variant_id" ON "product_variant_image" USING btree ("variant_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_image_image_id" ON "product_variant_image" USING btree ("image_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_image_variant_id_image_id" ON "product_variant_image" USING btree ("variant_id","image_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_option_variant_id" ON "product_variant_option" USING btree ("variant_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_option_product_product_option_value_id" ON "product_variant_option" USING btree ("product_product_option_value_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_option_variant_value" ON "product_variant_option" USING btree ("variant_id","product_product_option_value_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_variant_product_id" ON "product_variant" USING btree ("product_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_sku" ON "product_variant" USING btree ("sku") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_barcode" ON "product_variant" USING btree ("barcode") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_ean" ON "product_variant" USING btree ("ean") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_variant_upc" ON "product_variant" USING btree ("upc") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_handle" ON "product" USING btree ("handle") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_product_type_id" ON "product" USING btree ("type_id") WHERE deleted_at IS NULL;