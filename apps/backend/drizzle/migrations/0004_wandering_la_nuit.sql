CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"payment_request_id" varchar(255),
	"payment_actions" jsonb,
	"tier_to_unlock" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"failure_code" varchar(100),
	"webhook_payload" jsonb,
	"paid_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now(),
	CONSTRAINT "payment_transactions_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_subscriptions" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"tier" varchar(50) DEFAULT 'FREE' NOT NULL,
	"uploads_count" integer DEFAULT 0 NOT NULL,
	"searches_count" integer DEFAULT 0 NOT NULL,
	"qa_count" integer DEFAULT 0 NOT NULL,
	"storage_used_bytes" bigint DEFAULT 0 NOT NULL,
	"expires_at" timestamp (3) with time zone,
	"last_reset_at" timestamp (3) with time zone DEFAULT now(),
	"updated_at" timestamp (3) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payment_trx_tenant_status" ON "payment_transactions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_payment_trx_external_id" ON "payment_transactions" USING btree ("external_id");