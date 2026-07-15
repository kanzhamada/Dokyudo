CREATE TYPE "public"."activity_action_enum" AS ENUM('auth.login', 'auth.logout', 'auth.register', 'auth.password_reset', 'document.uploaded', 'document.deleted', 'document.processed', 'search.performed', 'chat.started', 'billing.checkout_initiated', 'billing.payment_completed', 'tenant.name_updated');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"action" "activity_action_enum" NOT NULL,
	"resource_type" varchar(100),
	"resource_id" varchar(255),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_id" varchar(36),
	"created_at" timestamp (3) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_tenant_created" ON "activity_logs" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_activity_user_created" ON "activity_logs" USING btree ("user_id","created_at" DESC NULLS LAST);