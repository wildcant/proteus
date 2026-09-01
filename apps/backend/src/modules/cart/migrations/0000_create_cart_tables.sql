CREATE TYPE "public"."cart_address_type" AS ENUM('shipping', 'billing');--> statement-breakpoint
CREATE TABLE "cart_address" (
	"id" text PRIMARY KEY DEFAULT CONCAT('caaddr_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"cart_id" text NOT NULL,
	"type" "cart_address_type" NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" text PRIMARY KEY DEFAULT CONCAT('cart_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"region_id" text,
	"customer_id" text,
	"sales_channel_id" text,
	"email" text,
	"currency_code" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cart_line_item" (
	"id" text PRIMARY KEY DEFAULT CONCAT('cali_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"cart_id" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"thumbnail" text,
	"quantity" integer NOT NULL,
	"variant_id" text,
	"product_id" text,
	"product_title" text,
	"product_description" text,
	"product_subtitle" text,
	"product_type" text,
	"product_handle" text,
	"variant_sku" text,
	"variant_barcode" text,
	"variant_title" text,
	"variant_option_values" text,
	"requires_shipping" boolean DEFAULT true NOT NULL,
	"is_discountable" boolean DEFAULT true NOT NULL,
	"is_giftcard" boolean DEFAULT false NOT NULL,
	"is_tax_inclusive" boolean DEFAULT false NOT NULL,
	"compare_at_unit_price" numeric,
	"unit_price" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cart_shipping_method" (
	"id" text PRIMARY KEY DEFAULT CONCAT('casm_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"cart_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"amount" numeric NOT NULL,
	"is_tax_inclusive" boolean DEFAULT false NOT NULL,
	"shipping_option_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cart_address" ADD CONSTRAINT "cart_address_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line_item" ADD CONSTRAINT "cart_line_item_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_shipping_method" ADD CONSTRAINT "cart_shipping_method_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cart_address_unique_cart_type" ON "cart_address" USING btree ("cart_id","type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_customer_id" ON "cart" USING btree ("customer_id") WHERE customer_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_currency_code" ON "cart" USING btree ("currency_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_region_id" ON "cart" USING btree ("region_id") WHERE region_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_sales_channel_id" ON "cart" USING btree ("sales_channel_id") WHERE sales_channel_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_line_item_cart_id" ON "cart_line_item" USING btree ("cart_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_line_item_variant_id" ON "cart_line_item" USING btree ("variant_id") WHERE variant_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_line_item_product_id" ON "cart_line_item" USING btree ("product_id") WHERE product_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_shipping_method_cart_id" ON "cart_shipping_method" USING btree ("cart_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_shipping_method_option_id" ON "cart_shipping_method" USING btree ("shipping_option_id") WHERE shipping_option_id IS NOT NULL AND deleted_at IS NULL;