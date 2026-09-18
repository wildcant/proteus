CREATE TABLE "ac_permission" (
	"id" text PRIMARY KEY DEFAULT CONCAT('acperm_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"key" text NOT NULL,
	"module" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignable" boolean DEFAULT true NOT NULL,
	"registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ac_role" (
	"id" text PRIMARY KEY DEFAULT CONCAT('acrole_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_immutable" boolean DEFAULT false NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ac_actor_role_assignment" (
	"id" text PRIMARY KEY DEFAULT CONCAT('acassign_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"actor_id" text NOT NULL,
	"role_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ac_permission_key" ON "ac_permission" USING btree ("key") WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ac_role_name" ON "ac_role" USING btree ("name") WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ac_actor_role_unique" ON "ac_actor_role_assignment" USING btree ("actor_type","actor_id","role_id") WHERE deleted_at IS NULL;
