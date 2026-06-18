import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../shared/models/db.model.ts";

/**
 * Super User Connection.
 * Bypasses RLS. Use for admin operations, background jobs, and migrations.
 */
const queryClient = postgres(Deno.env.get("DATABASE_URL") as string, {
    max: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
});

export const db = drizzle(queryClient, { schema });

/**
 * Returns a configured Drizzle transaction instance simulating the `anon` Supabase role.
 */
export async function withAnonDb<T>(
    callback: (tx: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>
): Promise<T> {
    return await db.transaction(async (tx) => {
        await tx.execute(sql`set local role anon`);
        return await callback(tx as any);
    });
}

/**
 * Returns a configured Drizzle transaction instance simulating the `authenticated` Supabase role.
 * Automatically injects the user's `sub` (ID) into the JWT claims for RLS to evaluate.
 */
export async function withAuthDb<T>(
    userId: string,
    callback: (tx: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>
): Promise<T> {
    return await db.transaction(async (tx) => {
        await tx.execute(sql`set local role authenticated`);
        await tx.execute(
            sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId })}, true)`
        );
        return await callback(tx as any);
    });
}
