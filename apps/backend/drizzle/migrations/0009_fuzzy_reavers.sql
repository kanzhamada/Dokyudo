CREATE TYPE "public"."auth_provider_enum" AS ENUM('email', 'forget_password', 'register', 'oauth_google', 'oauth_github');--> statement-breakpoint
CREATE TYPE "public"."document_status_enum" AS ENUM('pending', 'confirmed', 'processed', 'quota_exhausted', 'failed');--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."document_status_enum";--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "status" SET DATA TYPE "public"."document_status_enum" USING "status"::"public"."document_status_enum";--> statement-breakpoint
ALTER TABLE "login_attempts" ALTER COLUMN "auth_provider" SET DEFAULT 'email'::"public"."auth_provider_enum";--> statement-breakpoint
ALTER TABLE "login_attempts" ALTER COLUMN "auth_provider" SET DATA TYPE "public"."auth_provider_enum" USING "auth_provider"::"public"."auth_provider_enum";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL;