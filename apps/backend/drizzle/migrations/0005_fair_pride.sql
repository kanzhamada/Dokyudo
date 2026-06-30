CREATE TYPE "public"."payment_status_enum" AS ENUM('PENDING', 'ACCEPTING_PAYMENTS', 'SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."tier_enum" AS ENUM('FREE', 'SIMULATE', 'INVESTOR', 'REAL');--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "tier_to_unlock" SET DATA TYPE "public"."tier_enum" USING "tier_to_unlock"::"public"."tier_enum";--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."payment_status_enum";--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "status" SET DATA TYPE "public"."payment_status_enum" USING "status"::"public"."payment_status_enum";--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "tier" SET DEFAULT 'FREE'::"public"."tier_enum";--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "tier" SET DATA TYPE "public"."tier_enum" USING "tier"::"public"."tier_enum";