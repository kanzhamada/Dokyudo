-- Migration: Change tenant_keys primary key to composite (tenant_id, provider)
-- This allows a single tenant to store multiple provider keys.

ALTER TABLE "tenant_keys" DROP CONSTRAINT IF EXISTS "tenant_keys_pkey";
ALTER TABLE "tenant_keys" ADD CONSTRAINT "tenant_keys_pkey" PRIMARY KEY ("tenant_id", "provider");
