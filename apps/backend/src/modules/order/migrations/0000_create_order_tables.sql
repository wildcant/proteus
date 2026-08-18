CREATE TYPE "public"."order_fulfillment_status" AS ENUM('unfulfilled', 'fulfilled', 'shipped', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'completed', 'canceled', 'archived');--> statement-breakpoint
CREATE TABLE "order_address" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ordaddr_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
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
CREATE TABLE "order_line_item" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ordli_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"order_id" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"thumbnail" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric NOT NULL,
	"compare_at_unit_price" numeric,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_shipping_method" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ordsm_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"order_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"amount" numeric NOT NULL,
	"shipping_option_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ord_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"display_id" serial NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"fulfillment_status" "order_fulfillment_status" DEFAULT 'unfulfilled' NOT NULL,
	"email" text,
	"customer_id" text,
	"currency_code" text NOT NULL,
	"shipping_address_id" text,
	"billing_address_id" text,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_transaction" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ordtrx_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"order_id" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency_code" text NOT NULL,
	"reference" text,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "order_line_item" ADD CONSTRAINT "order_line_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shipping_method" ADD CONSTRAINT "order_shipping_method_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_shipping_address_id_order_address_id_fk" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."order_address"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_billing_address_id_order_address_id_fk" FOREIGN KEY ("billing_address_id") REFERENCES "public"."order_address"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transaction" ADD CONSTRAINT "order_transaction_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_order_line_item_order_id" ON "order_line_item" USING btree ("order_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_order_line_item_variant_id" ON "order_line_item" USING btree ("variant_id") WHERE deleted_at IS NULL AND variant_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_order_line_item_product_id" ON "order_line_item" USING btree ("product_id") WHERE deleted_at IS NULL AND product_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_order_shipping_method_order_id" ON "order_shipping_method" USING btree ("order_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_order_shipping_method_option_id" ON "order_shipping_method" USING btree ("shipping_option_id") WHERE deleted_at IS NULL AND shipping_option_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_order_display_id" ON "order" USING btree ("display_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_order_customer_id" ON "order" USING btree ("customer_id") WHERE deleted_at IS NULL AND customer_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_order_currency_code" ON "order" USING btree ("currency_code") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_order_status" ON "order" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_order_transaction_order_id" ON "order_transaction" USING btree ("order_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_order_transaction_reference" ON "order_transaction" USING btree ("reference","reference_id") WHERE deleted_at IS NULL;