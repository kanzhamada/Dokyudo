ALTER TABLE "payment_transactions" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING'::text;--> statement-breakpoint
DROP TYPE "public"."payment_status_enum";--> statement-breakpoint
CREATE TYPE "public"."payment_status_enum" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED');--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."payment_status_enum";--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "status" SET DATA TYPE "public"."payment_status_enum" USING "status"::"public"."payment_status_enum";--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "stripe_session_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD COLUMN "stripe_subscription_id" varchar(255);--> statement-breakpoint
CREATE INDEX "idx_payment_trx_stripe_session" ON "payment_transactions" USING btree ("stripe_session_id");--> statement-breakpoint
ALTER TABLE "payment_transactions" DROP COLUMN "payment_request_id";--> statement-breakpoint
ALTER TABLE "payment_transactions" DROP COLUMN "payment_actions";--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");