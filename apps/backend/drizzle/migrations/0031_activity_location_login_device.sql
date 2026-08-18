-- Add geolocation to activity logs (resolved country name from CF-IPCountry).
ALTER TABLE "activity_logs"
    ADD COLUMN IF NOT EXISTS "location" varchar(100);
--> statement-breakpoint

-- Add parsed device brand/model to login attempts (anti-bruteforce audit).
ALTER TABLE "login_attempts"
    ADD COLUMN IF NOT EXISTS "device_brand" varchar(100),
    ADD COLUMN IF NOT EXISTS "device_model" varchar(200);