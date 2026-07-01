ALTER TABLE "payment_transactions" ALTER COLUMN "tier_to_unlock" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "tier" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "tier" SET DEFAULT 'FREE'::text;--> statement-breakpoint
UPDATE "tenant_subscriptions" SET "tier" = 'PRO' WHERE "tier" = 'REAL';--> statement-breakpoint
UPDATE "tenant_subscriptions" SET "tier" = 'OIL_INVESTOR' WHERE "tier" = 'INVESTOR';--> statement-breakpoint
UPDATE "payment_transactions" SET "tier_to_unlock" = 'PRO' WHERE "tier_to_unlock" = 'REAL';--> statement-breakpoint
UPDATE "payment_transactions" SET "tier_to_unlock" = 'OIL_INVESTOR' WHERE "tier_to_unlock" = 'INVESTOR';--> statement-breakpoint
DROP TYPE "public"."tier_enum";--> statement-breakpoint
CREATE TYPE "public"."tier_enum" AS ENUM('FREE', 'SIMULATE', 'OIL_INVESTOR', 'PRO');--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "tier_to_unlock" SET DATA TYPE "public"."tier_enum" USING "tier_to_unlock"::"public"."tier_enum";--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "tier" SET DEFAULT 'FREE'::"public"."tier_enum";--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "tier" SET DATA TYPE "public"."tier_enum" USING "tier"::"public"."tier_enum";--> statement-breakpoint
ALTER TABLE "payment_transactions" DROP COLUMN "failure_code";