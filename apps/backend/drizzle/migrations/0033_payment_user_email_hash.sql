-- Add pseudonymized user_email_hash column to payment_transactions for cross-account/lifecycle trial limit enforcement
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "user_email_hash" varchar(64);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_payment_trx_email_tier_claim" ON "payment_transactions" ("user_email_hash", "tier_to_unlock", "status", "paid_at");
