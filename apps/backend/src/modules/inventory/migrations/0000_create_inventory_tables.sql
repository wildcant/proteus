CREATE TABLE "inventory_item" (
	"id" text PRIMARY KEY DEFAULT CONCAT('iitem_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"sku" text,
	"origin_country" text,
	"hs_code" text,
	"mid_code" text,
	"material" text,
	"weight" integer,
	"length" integer,
	"height" integer,
	"width" integer,
	"requires_shipping" boolean DEFAULT true NOT NULL,
	"description" text,
	"title" text,
	"thumbnail" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_level" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ilev_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"inventory_item_id" text NOT NULL,
	"location_id" text NOT NULL,
	"stocked_quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"incoming_quantity" integer DEFAULT 0 NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reservation_item" (
	"id" text PRIMARY KEY DEFAULT CONCAT('resitem_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"inventory_item_id" text NOT NULL,
	"location_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"line_item_id" text,
	"allow_backorder" boolean DEFAULT false NOT NULL,
	"external_id" text,
	"description" text,
	"created_by" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_item" ADD CONSTRAINT "reservation_item_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_inventory_item_sku" ON "inventory_item" USING btree ("sku") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_inventory_level_item_location" ON "inventory_level" USING btree ("inventory_item_id","location_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_inventory_level_inventory_item_id" ON "inventory_level" USING btree ("inventory_item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_inventory_level_location_id" ON "inventory_level" USING btree ("location_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_reservation_item_inventory_item_id" ON "reservation_item" USING btree ("inventory_item_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_reservation_item_location_id" ON "reservation_item" USING btree ("location_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_reservation_item_line_item_id" ON "reservation_item" USING btree ("line_item_id") WHERE deleted_at IS NULL;