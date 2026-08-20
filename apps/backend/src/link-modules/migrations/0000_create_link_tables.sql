CREATE TABLE "cart_payment_collection" (
	"id" text PRIMARY KEY DEFAULT CONCAT('cartpaycol_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"cart_id" text NOT NULL,
	"payment_collection_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_cart" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ordcart_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"order_id" text NOT NULL,
	"cart_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_fulfillment" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ordful_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"order_id" text NOT NULL,
	"fulfillment_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_payment_collection" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ordpaycol_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"order_id" text NOT NULL,
	"payment_collection_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_variant_inventory_item" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pvitem_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"variant_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"required_quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_variant_price_set" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pvps_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"variant_id" text NOT NULL,
	"price_set_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cart_payment_collection" ON "cart_payment_collection" USING btree ("cart_id","payment_collection_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_cart" ON "order_cart" USING btree ("order_id","cart_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_fulfillment" ON "order_fulfillment" USING btree ("order_id","fulfillment_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_payment_collection" ON "order_payment_collection" USING btree ("order_id","payment_collection_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pvitem_variant_inventory" ON "product_variant_inventory_item" USING btree ("variant_id","inventory_item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pvitem_variant_id" ON "product_variant_inventory_item" USING btree ("variant_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pvitem_inventory_item_id" ON "product_variant_inventory_item" USING btree ("inventory_item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pvps_variant_price_set" ON "product_variant_price_set" USING btree ("variant_id","price_set_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pvps_variant_id" ON "product_variant_price_set" USING btree ("variant_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_pvps_price_set_id" ON "product_variant_price_set" USING btree ("price_set_id") WHERE deleted_at IS NULL;