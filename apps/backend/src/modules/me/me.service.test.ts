import { describe, it } from "jsr:@std/testing/bdd";
import { assertRejects, assertEquals } from "jsr:@std/assert";
import { MeService } from "./me.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import { tenants, users } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";

describe("MeService Isolated Tests", () => {
    describe("getProfile", () => {
        it("negative: rejects when user or tenant does not exist", async () => {
            const nonExistentId = crypto.randomUUID();
            await assertRejects(
                () =>
                    MeService.getProfile({
                        userId: nonExistentId,
                        tenantId: nonExistentId,
                    }),
            );
        });
    });

    describe("getUsage", () => {
        it("negative: rejects when subscription does not exist", async () => {
            const fakeUserId = crypto.randomUUID();
            const fakeTenantId = crypto.randomUUID();
            await assertRejects(
                () =>
                    MeService.getUsage({
                        userId: fakeUserId,
                        tenantId: fakeTenantId,
                    }),
            );
        });
    });

    describe("updateTenantName", () => {
        it("positive: updates tenant name and returns updated record", async () => {
            const dummyTenantId = crypto.randomUUID();
            const dummyUserId = crypto.randomUUID();
            const dummyEmail = `test-tenant-${Date.now()}@example.com`;

            await db.insert(tenants).values({
                id: dummyTenantId,
                name: "Initial Name",
            });
            await db.insert(users).values({
                id: dummyUserId,
                tenantId: dummyTenantId,
                email: dummyEmail,
            });

            const logContext: Record<string, any> = {};
            const result = await MeService.updateTenantName({
                userId: dummyUserId,
                tenantId: dummyTenantId,
                name: "Updated Workspace Name",
                logContext,
            });

            assertEquals(result.tenant.name, "Updated Workspace Name");
            assertEquals(result.tenant.id, dummyTenantId);
            assertEquals(logContext.authEvent, "tenant_name_updated");

            // Cleanup
            await db.delete(users).where(eq(users.id, dummyUserId));
            await db.delete(tenants).where(eq(tenants.id, dummyTenantId));
        });

        it("negative: throws VALIDATION_ERROR for non-existent tenant", async () => {
            await assertRejects(
                () =>
                    MeService.updateTenantName({
                        userId: crypto.randomUUID(),
                        tenantId: crypto.randomUUID(),
                        name: "Ghost Workspace",
                    }),
                AppError,
                "Tenant not found",
            );
        });
    });

    describe("updatePassword", () => {
        it("negative: rejects invalid or expired access token", async () => {
            await assertRejects(
                () =>
                    MeService.updatePassword({
                        accessToken: "invalid_dummy_token_xyz",
                        newPassword: "NewSecurePassword123!",
                    }),
                AppError,
                "Invalid or expired session",
            );
        });
    });
});
