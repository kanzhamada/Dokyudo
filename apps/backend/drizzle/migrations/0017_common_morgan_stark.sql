CREATE TYPE "public"."turn_status_enum" AS ENUM('complete', 'stopped', 'failed');--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD COLUMN "status" "turn_status_enum" DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD COLUMN "updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL;