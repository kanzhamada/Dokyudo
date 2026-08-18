import { describe, it, beforeEach, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { db } from "../../config/drizzle.ts";
import { provisionTenantForUser } from "./user_provision.util.ts";
import {
    tenantSubscriptions,
    tenants,
    users,
} from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";

describe("provisionTenantForUser", () => {
    let userId: string;
    let email: string;

    beforeEach(() => {
        userId = crypto.randomUUID();
        email = `provision-${crypto.randomUUID()}@example.com`;
    });

    afterAll(async () => {
        const orphans = await db
            .select({ id: users.id, tenantId: users.tenantId })
            .from(users)
            .where(eq(users.email, email));
        for (const u of orphans) {
            await db.delete(tenantSubscriptions).where(
                eq(tenantSubscriptions.tenantId, u.tenantId),
            );
            await db.delete(users).where(eq(users.id, u.id));
            await db.delete(tenants).where(eq(tenants.id, u.tenantId));
        }
    });

    it("creates tenant, user, and FREE subscription for a missing row", async () => {
        const tenantId = await provisionTenantForUser({ userId, email });

        assertExists(tenantId);

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));
        assertExists(user);
        assertEquals(user.deletionStatus, "active");
        assertEquals(user.tenantId, tenantId);

        const [sub] = await db
            .select()
            .from(tenantSubscriptions)
            .where(eq(tenantSubscriptions.tenantId, tenantId));
        assertExists(sub);
        assertEquals(sub.tier, "FREE");
    });

    it("reuses the existing mapping when the user row already exists", async () => {
        const existingTenantId = crypto.randomUUID();
        await db.insert(tenants).values({ id: existingTenantId, name: "Existing" });
        await db.insert(users).values({
            id: userId,
            tenantId: existingTenantId,
            email,
        });

        const tenantId = await provisionTenantForUser({ userId, email });

        // Same tenant is returned, no duplicate user/tenant rows created.
        assertEquals(tenantId, existingTenantId);
        const count = await db
            .select({ tenantId: users.tenantId })
            .from(users)
            .where(eq(users.id, userId));
        assertEquals(count.length, 1);
    });

    it("creates a fresh active account even when a soft-deleted row uses the same email", async () => {
        const oldTenantId = crypto.randomUUID();
        await db.insert(tenants).values({
            id: oldTenantId,
            name: "Old Deleted",
            deletionStatus: "deleted",
            deletedAt: new Date(),
        });
        await db.insert(users).values({
            id: crypto.randomUUID(),
            tenantId: oldTenantId,
            email,
            deletionStatus: "deleted",
            deletedAt: new Date(),
        });

        const tenantId = await provisionTenantForUser({ userId, email });
        assertExists(tenantId);
        // A brand-new tenant, NOT the old soft-deleted one.
        assertEquals(tenantId === oldTenantId, false);

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));
        assertExists(user);
        assertEquals(user.deletionStatus, "active");
        assertEquals(user.email, email);
    });
});