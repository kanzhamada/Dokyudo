import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { provisionTenantForUser } from "./user_provision.util.ts";
import { db } from "../../config/drizzle.ts";
import { tenantSubscriptions, tenants, users } from "../models/db.model.ts";
import { eq } from "drizzle-orm";

describe("provisionTenantForUser Utility", () => {
    it("positive: provisions tenant, user, and FREE subscription for new auth user", async () => {
        const dummyUserId = crypto.randomUUID();
        const dummyEmail = `test-provision-${Date.now()}@example.com`;
        const logContext: Record<string, any> = {};

        const tenantId = await provisionTenantForUser({
            userId: dummyUserId,
            email: dummyEmail,
            avatarUrl: "https://example.com/avatar.png",
            logContext,
        });

        assertExists(tenantId);
        assertEquals(logContext.provisionedTenantFallback, true);

        // Verify DB rows
        const [userRow] = await db.select().from(users).where(eq(users.id, dummyUserId));
        assertExists(userRow);
        assertEquals(userRow.email, dummyEmail);
        assertEquals(userRow.tenantId, tenantId);
        assertEquals(userRow.profilePictureUrl, "https://example.com/avatar.png");

        const [subRow] = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId!));
        assertExists(subRow);
        assertEquals(subRow.tier, "FREE");

        // Cleanup
        await db.delete(users).where(eq(users.id, dummyUserId));
        await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId!));
        await db.delete(tenants).where(eq(tenants.id, tenantId!));
    });

    it("positive: handles race condition when user is concurrently provisioned", async () => {
        const dummyUserId = crypto.randomUUID();
        const dummyEmail = `test-race-${Date.now()}@example.com`;

        // First call provisions normally
        const firstTenantId = await provisionTenantForUser({
            userId: dummyUserId,
            email: dummyEmail,
        });
        assertExists(firstTenantId);

        // Second call hits ON CONFLICT and reuses existing tenant
        const logContext: Record<string, any> = {};
        const secondTenantId = await provisionTenantForUser({
            userId: dummyUserId,
            email: dummyEmail,
            logContext,
        });

        assertEquals(secondTenantId, firstTenantId);
        assertEquals(logContext.provisionedTenantFallback, false);

        // Cleanup
        await db.delete(users).where(eq(users.id, dummyUserId));
        await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, firstTenantId!));
        await db.delete(tenants).where(eq(tenants.id, firstTenantId!));
    });
});
