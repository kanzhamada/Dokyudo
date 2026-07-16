import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { db } from "../../config/drizzle.ts";
import { tenants, activityLogs } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { ActivitiesService } from "./activities.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";

describe("ActivitiesService", () => {
    const TEST_TENANT_ID = crypto.randomUUID();

    beforeAll(async () => {
        // Create dummy tenant
        await db.insert(tenants).values({
            id: TEST_TENANT_ID,
            name: "Activities Service Test Tenant",
        }).onConflictDoNothing();

        // Insert 3 dummy activities
        await db.insert(activityLogs).values([
            {
                tenantId: TEST_TENANT_ID,
                action: "document.uploaded",
                resourceType: "DOCUMENT",
                resourceId: "doc-1",
                ipAddress: "127.0.0.1",
                userAgent: "TestAgent",
            },
            {
                tenantId: TEST_TENANT_ID,
                action: "document.processed",
                resourceType: "DOCUMENT",
                resourceId: "doc-1",
                ipAddress: "127.0.0.1",
                userAgent: "TestAgent",
            },
            {
                tenantId: TEST_TENANT_ID,
                action: "document.deleted",
                resourceType: "DOCUMENT",
                resourceId: "doc-1",
                ipAddress: "127.0.0.1",
                userAgent: "TestAgent",
            }
        ]);
    });

    afterAll(async () => {
        await db.delete(activityLogs).where(eq(activityLogs.tenantId, TEST_TENANT_ID));
        await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
    });

    describe("getActivities", () => {
        it("positive: returns paginated activities correctly (page 1)", async () => {
            const res = await ActivitiesService.getActivities({
                tenantId: TEST_TENANT_ID,
                page: 1,
                limit: 2,
            });

            assertEquals(res.data.length, 2);
            assertEquals(res.meta.total, 3);
            assertEquals(res.meta.totalPages, 2);
            assertEquals(res.meta.page, 1);
            assertEquals(res.meta.limit, 2);
            
            // Check mapping
            assertEquals(typeof res.data[0].createdAt, "string");
        });

        it("positive: returns paginated activities correctly (page 2)", async () => {
            const res = await ActivitiesService.getActivities({
                tenantId: TEST_TENANT_ID,
                page: 2,
                limit: 2,
            });

            assertEquals(res.data.length, 1);
            assertEquals(res.meta.total, 3);
            assertEquals(res.meta.totalPages, 2);
            assertEquals(res.meta.page, 2);
        });

        it("positive: returns empty array if no activities for tenant", async () => {
            const OTHER_TENANT_ID = crypto.randomUUID();
            const res = await ActivitiesService.getActivities({
                tenantId: OTHER_TENANT_ID,
                page: 1,
                limit: 10,
            });

            assertEquals(res.data.length, 0);
            assertEquals(res.meta.total, 0);
            assertEquals(res.meta.totalPages, 0);
        });

        it("negative: throws INTERNAL_ERROR if db query fails", async () => {
            // Stub db.select to throw
            using selectStub = stub(db, "select", () => {
                throw new Error("DB Connection Error");
            });

            const error = await assertRejects(
                () => ActivitiesService.getActivities({
                    tenantId: TEST_TENANT_ID,
                    page: 1,
                    limit: 10,
                }),
                AppError
            );

            assertEquals(error.code, "INTERNAL_ERROR");
            assertEquals(error.status, 500);
        });
    });
});
