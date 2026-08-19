-- Remove OS/device/geolocation columns from activity logs.
ALTER TABLE "activity_logs"
    DROP COLUMN IF EXISTS "operating_system",
    DROP COLUMN IF EXISTS "device_type",
    DROP COLUMN IF EXISTS "location";
--> statement-breakpoint

-- Remove parsed device brand/model from login attempts.
ALTER TABLE "login_attempts"
    DROP COLUMN IF EXISTS "device_brand",
    DROP COLUMN IF EXISTS "device_model";