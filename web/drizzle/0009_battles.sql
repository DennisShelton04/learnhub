CREATE TYPE "public"."battle_status" AS ENUM('lobby', 'question', 'reveal', 'finished');--> statement-breakpoint
CREATE TABLE "battle" (
	"id" text PRIMARY KEY NOT NULL,
	"quiz_id" text NOT NULL,
	"community_id" text NOT NULL,
	"host_id" text NOT NULL,
	"status" "battle_status" DEFAULT 'lobby' NOT NULL,
	"current_index" integer DEFAULT -1 NOT NULL,
	"seconds_per_question" integer DEFAULT 20 NOT NULL,
	"question_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "battle_answer" (
	"battle_id" text NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"option_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"points" integer NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battle_answer_battle_id_user_id_question_id_pk" PRIMARY KEY("battle_id","user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "battle_player" (
	"battle_id" text NOT NULL,
	"user_id" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battle_player_battle_id_user_id_pk" PRIMARY KEY("battle_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_community_id_community_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_answer" ADD CONSTRAINT "battle_answer_battle_id_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_answer" ADD CONSTRAINT "battle_answer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_answer" ADD CONSTRAINT "battle_answer_question_id_quiz_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_answer" ADD CONSTRAINT "battle_answer_option_id_quiz_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."quiz_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_player" ADD CONSTRAINT "battle_player_battle_id_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_player" ADD CONSTRAINT "battle_player_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "battle_community_idx" ON "battle" USING btree ("community_id","status");