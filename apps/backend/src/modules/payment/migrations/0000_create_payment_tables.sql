CREATE TYPE "public"."payment_collection_status" AS ENUM('not_paid', 'awaiting', 'authorized', 'partially_authorized', 'completed');--> statement-breakpoint
CREATE TYPE "public"."payment_session_status" AS ENUM('pending', 'authorized', 'captured', 'requires_more', 'error', 'canceled', 'pending_authorization');--> statement-breakpoint
CREATE TABLE "account_holder" (
	"id" text PRIMARY KEY DEFAULT CONCAT('acchld_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"email" text,
	"external_id" text NOT NULL,
	"metadata" jsonb,
	"provider_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "capture" (
	"id" text PRIMARY KEY DEFAULT CONCAT('capt_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"amount" numeric NOT NULL,
	"created_by" text,
	"metadata" jsonb,
	"payment_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_collection" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pay_col_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"amount" numeric NOT NULL,
	"authorized_amount" numeric,
	"captured_amount" numeric,
	"completed_at" timestamp with time zone,
	"currency_code" text DEFAULT 'usd' NOT NULL,
	"metadata" jsonb,
	"refunded_amount" numeric,
	"status" "payment_collection_status" DEFAULT 'not_paid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_session" (
	"id" text PRIMARY KEY DEFAULT CONCAT('payses_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"amount" numeric NOT NULL,
	"authorized_at" timestamp with time zone,
	"context" jsonb,
	"currency_code" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb,
	"payment_collection_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"status" "payment_session_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY DEFAULT CONCAT('pay_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"amount" numeric NOT NULL,
	"canceled_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"currency_code" text NOT NULL,
	"data" jsonb,
	"metadata" jsonb,
	"payment_collection_id" text NOT NULL,
	"payment_session_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refund_reason" (
	"id" text PRIMARY KEY DEFAULT CONCAT('refr_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"label" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ref_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"amount" numeric NOT NULL,
	"created_by" text,
	"metadata" jsonb,
	"note" text,
	"payment_id" text NOT NULL,
	"refund_reason_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "capture" ADD CONSTRAINT "capture_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_session" ADD CONSTRAINT "payment_session_payment_collection_id_payment_collection_id_fk" FOREIGN KEY ("payment_collection_id") REFERENCES "public"."payment_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_payment_collection_id_payment_collection_id_fk" FOREIGN KEY ("payment_collection_id") REFERENCES "public"."payment_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_payment_session_id_payment_session_id_fk" FOREIGN KEY ("payment_session_id") REFERENCES "public"."payment_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_refund_reason_id_refund_reason_id_fk" FOREIGN KEY ("refund_reason_id") REFERENCES "public"."refund_reason"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_account_holder_provider_external" ON "account_holder" USING btree ("provider_id","external_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_capture_payment_id" ON "capture" USING btree ("payment_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_payment_collection_status" ON "payment_collection" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_payment_session_collection_id" ON "payment_session" USING btree ("payment_collection_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_payment_provider_id" ON "payment" USING btree ("provider_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_payment_collection_id" ON "payment" USING btree ("payment_collection_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_payment_session_id" ON "payment" USING btree ("payment_session_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_refund_payment_id" ON "refund" USING btree ("payment_id") WHERE deleted_at IS NULL;