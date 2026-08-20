CREATE TYPE "public"."cart_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "cart_address" (
	"id" text PRIMARY KEY DEFAULT CONCAT('caaddr_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"customer_id" text,
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
	"status" "cart_status" DEFAULT 'active' NOT NULL,
	"shipping_address_id" text,
	"billing_address_id" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cart_credit_line" (
	"id" text PRIMARY KEY DEFAULT CONCAT('cacl_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"cart_id" text NOT NULL,
	"reference" text,
	"reference_id" text,
	"amount" integer NOT NULL,
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
CREATE TABLE "cart_line_item_tax_line" (
	"id" text PRIMARY KEY DEFAULT CONCAT('calitxl_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"item_id" text NOT NULL,
	"code" text NOT NULL,
	"rate" real NOT NULL,
	"description" text,
	"provider_id" text,
	"tax_rate_id" text,
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
CREATE TABLE "cart_shipping_method_tax_line" (
	"id" text PRIMARY KEY DEFAULT CONCAT('casmtxl_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"shipping_method_id" text NOT NULL,
	"code" text NOT NULL,
	"rate" real NOT NULL,
	"description" text,
	"provider_id" text,
	"tax_rate_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_shipping_address_id_cart_address_id_fk" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."cart_address"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_billing_address_id_cart_address_id_fk" FOREIGN KEY ("billing_address_id") REFERENCES "public"."cart_address"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_credit_line" ADD CONSTRAINT "cart_credit_line_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line_item" ADD CONSTRAINT "cart_line_item_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line_item_tax_line" ADD CONSTRAINT "cart_line_item_tax_line_item_id_cart_line_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."cart_line_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_shipping_method" ADD CONSTRAINT "cart_shipping_method_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_shipping_method_tax_line" ADD CONSTRAINT "cart_shipping_method_tax_line_shipping_method_id_cart_shipping_method_id_fk" FOREIGN KEY ("shipping_method_id") REFERENCES "public"."cart_shipping_method"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cart_customer_id" ON "cart" USING btree ("customer_id") WHERE deleted_at IS NULL AND customer_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_currency_code" ON "cart" USING btree ("currency_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_region_id" ON "cart" USING btree ("region_id") WHERE deleted_at IS NULL AND region_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_sales_channel_id" ON "cart" USING btree ("sales_channel_id") WHERE deleted_at IS NULL AND sales_channel_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_credit_line_cart_id" ON "cart_credit_line" USING btree ("cart_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_credit_line_reference" ON "cart_credit_line" USING btree ("reference","reference_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_line_item_cart_id" ON "cart_line_item" USING btree ("cart_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_line_item_variant_id" ON "cart_line_item" USING btree ("variant_id") WHERE deleted_at IS NULL AND variant_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_line_item_product_id" ON "cart_line_item" USING btree ("product_id") WHERE deleted_at IS NULL AND product_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_line_item_tax_line_item_id" ON "cart_line_item_tax_line" USING btree ("item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_line_item_tax_line_tax_rate_id" ON "cart_line_item_tax_line" USING btree ("tax_rate_id") WHERE deleted_at IS NULL AND tax_rate_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_shipping_method_cart_id" ON "cart_shipping_method" USING btree ("cart_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_shipping_method_option_id" ON "cart_shipping_method" USING btree ("shipping_option_id") WHERE deleted_at IS NULL AND shipping_option_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_sm_tax_line_shipping_method_id" ON "cart_shipping_method_tax_line" USING btree ("shipping_method_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_cart_sm_tax_line_tax_rate_id" ON "cart_shipping_method_tax_line" USING btree ("tax_rate_id") WHERE deleted_at IS NULL AND tax_rate_id IS NOT NULL;