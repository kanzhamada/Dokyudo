import { db } from "../../config/drizzle.ts";
import { tenantSubscriptions, tenants, users } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";

/**
 * Provisions tenant + user + FREE subscription for a Supabase auth user whose
 * `public.users` row is missing — normally created by the
 * `handle_verified_user` DB trigger. Used as a fallback by OAuth, login, and
 * email verification so a missed/late trigger never leaves the user stuck in
 * "authenticated but no tenant" limbo.
 *
 * Concurrent-safe: `ON CONFLICT DO NOTHING` on users.id; if another request
 * won the race, the tenant inserted here is rolled back and the existing
 * mapping is returned.
 *
 * Returns the tenantId, or null when the user row already exists but no
 * tenant could be resolved (callers decide how to fail).
 * DB errors propagate — callers wrap them in AppError.
 */
export async function provisionTenantForUser(params: {
    userId: string;
    email: string;
    avatarUrl?: string | null;
    logContext?: Record<string, any>;
}): Promise<string | null> {
    const { userId, email, avatarUrl, logContext } = params;

    return await db.transaction(async (tx) => {
        const [tenant] = await tx
            .insert(tenants)
            .values({ name: email.slice(0, 255) })
            .returning({ id: tenants.id });

        const [insertedUser] = await tx
            .insert(users)
            .values({
                id: userId,
                tenantId: tenant.id,
                email,
                profilePictureUrl: avatarUrl ?? null,
            })
            .onConflictDoNothing()
            .returning({ id: users.id });

        if (!insertedUser) {
            // A concurrent request already provisioned this user. Drop the
            // tenant we just created and reuse the existing mapping.
            await tx.delete(tenants).where(eq(tenants.id, tenant.id));
            const [existing] = await tx
                .select({ tenantId: users.tenantId })
                .from(users)
                .where(eq(users.id, userId));
            if (logContext) logContext.provisionedTenantFallback = false;
            return existing?.tenantId ?? null;
        }

        await tx.insert(tenantSubscriptions).values({ tenantId: tenant.id });
        if (logContext) logContext.provisionedTenantFallback = true;
        return tenant.id;
    });
}