CREATE TABLE "actor_role_assignment" (
	"id" text PRIMARY KEY DEFAULT CONCAT('ara_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"role_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" text PRIMARY KEY DEFAULT CONCAT('perm_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"key" text NOT NULL,
	"module" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignable" boolean DEFAULT true NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" text PRIMARY KEY DEFAULT CONCAT('role_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"protected" boolean DEFAULT false NOT NULL,
	"features_json" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "actor_role_assignment" ADD CONSTRAINT "actor_role_assignment_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_actor_role_assignment_actor_role" ON "actor_role_assignment" USING btree ("actor_type","actor_id","role_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_permission_key" ON "permission" USING btree ("key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_role_name" ON "role" USING btree ("name") WHERE deleted_at IS NULL;