-- Store parsed client details alongside the raw User-Agent.
ALTER TABLE "activity_logs"
    ADD COLUMN IF NOT EXISTS "operating_system" varchar(100),
    ADD COLUMN IF NOT EXISTS "device_type" varchar(32);
--> statement-breakpoint

-- Invalid legacy proxy-header values cannot be represented by inet; preserve
-- valid addresses and convert invalid/empty values to NULL.
ALTER TABLE "activity_logs"
    ALTER COLUMN "ip_address" TYPE inet
    USING CASE
        WHEN "ip_address" IS NULL OR btrim("ip_address") = '' THEN NULL
        WHEN pg_input_is_valid(btrim("ip_address"), 'inet'::regtype)
            THEN btrim("ip_address")::inet
        ELSE NULL
    END;
