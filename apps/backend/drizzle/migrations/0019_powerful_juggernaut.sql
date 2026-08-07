ALTER TYPE "public"."turn_status_enum" ADD VALUE 'blocked';--> statement-breakpoint
ALTER TABLE "conversation_turns" ALTER COLUMN "model_used" DROP NOT NULL;