CREATE TABLE "invite" (
	"id" text PRIMARY KEY DEFAULT CONCAT('invite_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"email" text NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY DEFAULT CONCAT('usr_', REPLACE(gen_random_uuid()::text, '-', '')) NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invite_email" ON "invite" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_invite_token" ON "invite" USING btree ("token") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_email" ON "user" USING btree ("email") WHERE deleted_at IS NULL;