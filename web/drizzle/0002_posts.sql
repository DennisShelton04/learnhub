CREATE TYPE "public"."post_type" AS ENUM('video', 'article', 'note');--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY NOT NULL,
	"community_id" text NOT NULL,
	"author_id" text NOT NULL,
	"type" "post_type" NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"url" text,
	"video_id" text,
	"preview_title" text,
	"preview_description" text,
	"preview_image" text,
	"preview_site_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_community_created_idx" ON "post" USING btree ("community_id","created_at");