CREATE TABLE "tenant_keys" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(50) DEFAULT 'gemini' NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"iv" varchar(64) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now(),
	"updated_at" timestamp (3) with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tenant_keys" ADD CONSTRAINT "tenant_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;