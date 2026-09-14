CREATE TABLE "stock_location" (
	"id" text PRIMARY KEY DEFAULT CONCAT('sloc_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
