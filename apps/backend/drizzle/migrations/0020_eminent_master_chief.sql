CREATE TYPE "public"."feedback_enum" AS ENUM('good', 'bad');--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD COLUMN "feedback" "feedback_enum";--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD COLUMN "feedback_at" timestamp (3) with time zone;