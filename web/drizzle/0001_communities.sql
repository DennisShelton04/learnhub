CREATE TYPE "public"."community_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'moderator', 'member');--> statement-breakpoint
CREATE TABLE "community" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" "community_visibility" DEFAULT 'public' NOT NULL,
	"invite_code" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "community_slug_unique" UNIQUE("slug"),
	CONSTRAINT "community_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "community_member" (
	"community_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "community_member_community_id_user_id_pk" PRIMARY KEY("community_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "community" ADD CONSTRAINT "community_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_member" ADD CONSTRAINT "community_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_member_userId_idx" ON "community_member" USING btree ("user_id");