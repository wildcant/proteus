CREATE TYPE "public"."notification_status" AS ENUM('pending', 'success', 'failure');--> statement-breakpoint
CREATE TABLE "notification_provider" (
	"id" text PRIMARY KEY DEFAULT CONCAT('notpro_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"channels" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY DEFAULT CONCAT('noti_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"to" text NOT NULL,
	"from" text,
	"channel" text NOT NULL,
	"template" text,
	"data" jsonb,
	"provider_data" jsonb,
	"trigger_type" text,
	"resource_id" text,
	"resource_type" text,
	"receiver_id" text,
	"original_notification_id" text,
	"idempotency_key" text,
	"external_id" text,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_idempotency_key" ON "notification" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notification_channel" ON "notification" USING btree ("channel") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notification_status" ON "notification" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notification_provider_id" ON "notification" USING btree ("provider_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notification_receiver_id" ON "notification" USING btree ("receiver_id") WHERE deleted_at IS NULL;