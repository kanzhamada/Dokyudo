-- Convert activity_logs.ip_address from varchar to PostgreSQL inet.
--
-- pg_input_is_valid (PostgreSQL 17+) is not available on older versions (e.g.
-- Supabase PG 15), so instead we probe every non-empty value with a real cast
-- inside a DO block and null out anything the inet type cannot represent.
-- Empty strings and NULLs stay NULL.
DO $$
DECLARE
    row record;
BEGIN
    FOR row IN
        SELECT id, btrim(ip_address) AS raw_ip
        FROM activity_logs
        WHERE ip_address IS NOT NULL AND btrim(ip_address) <> ''
    LOOP
        BEGIN
            PERFORM row.raw_ip::inet;
        EXCEPTION
            WHEN invalid_text_representation THEN
                UPDATE activity_logs SET ip_address = NULL WHERE id = row.id;
        END;
    END LOOP;
END $$;
--> statement-breakpoint

ALTER TABLE "activity_logs"
    ALTER COLUMN "ip_address" TYPE inet
    USING NULLIF(btrim(ip_address), '')::inet;