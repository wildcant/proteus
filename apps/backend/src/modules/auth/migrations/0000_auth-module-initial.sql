CREATE TABLE "auth_identity" (
	"id" text PRIMARY KEY DEFAULT CONCAT('authid_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"app_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_password_reset_token" (
	"id" text PRIMARY KEY DEFAULT CONCAT('authprt_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"auth_identity_id" text NOT NULL,
	"provider_identity_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY DEFAULT CONCAT('authver_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"auth_identity_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"code_provider" text NOT NULL,
	"verified_at" timestamp with time zone,
	"requested_at" timestamp with time zone NOT NULL,
	"provider_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "provider_identity" (
	"id" text PRIMARY KEY DEFAULT CONCAT('provid_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"auth_identity_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_metadata" jsonb,
	"user_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "auth_password_reset_token" ADD CONSTRAINT "auth_password_reset_token_auth_identity_id_auth_identity_id_fk" FOREIGN KEY ("auth_identity_id") REFERENCES "public"."auth_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_password_reset_token" ADD CONSTRAINT "auth_password_reset_token_provider_identity_id_provider_identity_id_fk" FOREIGN KEY ("provider_identity_id") REFERENCES "public"."provider_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_verification" ADD CONSTRAINT "auth_verification_auth_identity_id_auth_identity_id_fk" FOREIGN KEY ("auth_identity_id") REFERENCES "public"."auth_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_identity" ADD CONSTRAINT "provider_identity_auth_identity_id_auth_identity_id_fk" FOREIGN KEY ("auth_identity_id") REFERENCES "public"."auth_identity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_password_reset_token_auth_identity" ON "auth_password_reset_token" USING btree ("auth_identity_id");--> statement-breakpoint
CREATE INDEX "idx_auth_password_reset_token_provider_identity" ON "auth_password_reset_token" USING btree ("provider_identity_id");--> statement-breakpoint
CREATE INDEX "idx_auth_password_reset_token_hash" ON "auth_password_reset_token" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_verification_identity_entity" ON "auth_verification" USING btree ("auth_identity_id","entity_id","entity_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_provider_identity_auth_identity_id" ON "provider_identity" USING btree ("auth_identity_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_provider_identity_entity_provider" ON "provider_identity" USING btree ("entity_id","provider") WHERE deleted_at IS NULL;