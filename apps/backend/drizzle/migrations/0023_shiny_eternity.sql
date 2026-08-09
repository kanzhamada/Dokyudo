CREATE TABLE "turn_alternatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"turn_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"model_used" varchar(100),
	"latency_ms" integer,
	"context_references" jsonb,
	"status" "turn_status_enum" DEFAULT 'complete' NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "turn_alternatives" ADD CONSTRAINT "turn_alternatives_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_alternatives" ADD CONSTRAINT "turn_alternatives_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_alternatives" ADD CONSTRAINT "turn_alternatives_turn_id_conversation_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."conversation_turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_turn_alternatives_turn" ON "turn_alternatives" USING btree ("turn_id");
--> statement-breakpoint
-- Supabase auto-enables RLS on new tables; conversations/conversation_turns
-- have it disabled (tenant isolation is enforced in app code via tenant_id
-- filters), so turn_alternatives matches its siblings.
ALTER TABLE "turn_alternatives" DISABLE ROW LEVEL SECURITY;
