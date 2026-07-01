import { db } from "./src/config/drizzle.ts";
import { sql } from "drizzle-orm";

async function run() {
  try {
    await db.execute(sql`ALTER TYPE "public"."tier_enum" ADD VALUE IF NOT EXISTS 'PRO'`);
    await db.execute(sql`ALTER TYPE "public"."tier_enum" ADD VALUE IF NOT EXISTS 'OIL_INVESTOR'`);
    
    await db.execute(sql`UPDATE "tenant_subscriptions" SET "tier" = 'PRO' WHERE "tier"::text = 'REAL'`);
    await db.execute(sql`UPDATE "tenant_subscriptions" SET "tier" = 'OIL_INVESTOR' WHERE "tier"::text = 'INVESTOR'`);
    
    await db.execute(sql`UPDATE "payment_transactions" SET "tier_to_unlock" = 'PRO' WHERE "tier_to_unlock"::text = 'REAL'`);
    await db.execute(sql`UPDATE "payment_transactions" SET "tier_to_unlock" = 'OIL_INVESTOR' WHERE "tier_to_unlock"::text = 'INVESTOR'`);
    console.log("Success!");
    Deno.exit(0);
  } catch(e) {
    console.error(e);
    Deno.exit(1);
  }
}
run();
