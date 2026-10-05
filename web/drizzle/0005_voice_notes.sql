CREATE TYPE "public"."message_kind" AS ENUM('text', 'voice');--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "kind" "message_kind" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "audio_key" text;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "audio_type" text;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "audio_duration_ms" integer;