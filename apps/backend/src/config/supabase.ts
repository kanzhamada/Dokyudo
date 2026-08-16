import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env.ts";

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
    if (!adminClient) {
        const url = getEnv("SUPABASE_URL");
        const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

        adminClient = createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }
    return adminClient;
}

export function getSupabaseAnon(): SupabaseClient {
    if (!anonClient) {
        const url = getEnv("SUPABASE_URL");
        const key = getEnv("SUPABASE_ANON_KEY");

        anonClient = createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                // OAuth uses server-side PKCE so the auth code comes back to
                // our backend callback (see oauth.service.ts initiateOAuth).
                flowType: "pkce",
            },
        });
    }
    return anonClient;
}
