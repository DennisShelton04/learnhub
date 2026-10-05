CREATE TYPE "public"."xp_kind" AS ENUM('post_shared', 'message_sent', 'voice_sent', 'quiz_created', 'quiz_completed', 'quiz_perfect', 'battle_played', 'battle_won');--> statement-breakpoint
CREATE TABLE "xp_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"community_id" text,
	"kind" "xp_kind" NOT NULL,
	"ref_id" text NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "xp_event_unique_idx" ON "xp_event" USING btree ("user_id","kind","ref_id");--> statement-breakpoint
CREATE INDEX "xp_event_user_idx" ON "xp_event" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "xp_event_community_idx" ON "xp_event" USING btree ("community_id","created_at");