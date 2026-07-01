import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { AuthService } from "./auth.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import { users, loginAttempts, tenants, tenantSubscriptions } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin } from "../../config/supabase.ts";

describe("AuthService Isolated Tests", () => {
    const TEST_EMAIL = `isolated_test_${crypto.randomUUID()}@example.com`;
    const TEST_IP = "127.0.0.1";
    const supabase = getSupabaseAdmin();

    beforeAll(async () => {
        // Enforce test environment so recaptcha passes natively (bypass)
        Deno.env.set("NODE_ENV", "dev");

        // Clean up from previous run if any
        await db.delete(loginAttempts).where(eq(loginAttempts.emailAttempted, TEST_EMAIL));
        await db.delete(users).where(eq(users.email, TEST_EMAIL));

        const { data } = await supabase.auth.admin.listUsers();
        // @ts-ignore - Supabase type mismatch
        const testUser = data.users.find((u: any) => u.email === TEST_EMAIL);
        if (testUser) {
            await supabase.auth.admin.deleteUser(testUser.id);
        }
    });

    afterAll(async () => {
        // Restore
        Deno.env.set("NODE_ENV", "test");

        // Cleanup
        await db.delete(loginAttempts).where(eq(loginAttempts.emailAttempted, TEST_EMAIL));
        await db.delete(users).where(eq(users.email, TEST_EMAIL));

        const { data } = await supabase.auth.admin.listUsers();
        // @ts-ignore - Supabase type mismatch
        const testUser = data.users.find((u: any) => u.email === TEST_EMAIL);
        if (testUser) {
            await supabase.auth.admin.deleteUser(testUser.id);
        }
    });

    describe("registerUser", () => {
        it("positive: registers a new user successfully", async () => {
            const logContext: any = {};
            await AuthService.registerUser({
                email: TEST_EMAIL,
                password: "StrongPassword123!",
                recaptchaToken: "bypass",
                clientIp: TEST_IP,
                requestId: crypto.randomUUID(),
                userAgent: "TestAgent",
                logContext,
            });

            assertEquals(logContext.authEvent, "user_registered");
            assertEquals(logContext.authEmail, TEST_EMAIL);

            // Verify login attempts logged
            const attempts = await db.select().from(loginAttempts).where(eq(loginAttempts.emailAttempted, TEST_EMAIL));
            assertEquals(attempts.length > 0, true);
            assertEquals(attempts[0].isSuccess, true);
        });

        it("negative: rejects duplicate registration", async () => {
            await assertRejects(
                () => AuthService.registerUser({
                    email: TEST_EMAIL,
                    password: "StrongPassword123!",
                    recaptchaToken: "bypass",
                    clientIp: TEST_IP,
                    requestId: crypto.randomUUID(),
                    userAgent: "TestAgent"
                }),
                AppError,
                "Account already registered"
            );
        });
    });

    describe("loginUser", () => {
        it("negative: rejects login for unverified user", async () => {
            await assertRejects(
                () => AuthService.loginUser({
                    email: TEST_EMAIL,
                    password: "StrongPassword123!",
                    recaptchaToken: "bypass",
                    clientIp: TEST_IP,
                    requestId: crypto.randomUUID(),
                    userAgent: "TestAgent",
                }),
                AppError,
                "Invalid email or password"
            );
        });
    });

    describe("forgetPassword", () => {
        it("positive: processes recovery for existing user", async () => {
            const logContext: any = {};
            await AuthService.forgetPassword({
                email: TEST_EMAIL,
                recaptchaToken: "bypass",
                clientIp: TEST_IP,
                requestId: crypto.randomUUID(),
                userAgent: "TestAgent",
                logContext
            });

            assertEquals(logContext.authEvent, "forget_password_success");
        });

        it("positive: silently ignores non-existent user", async () => {
            const logContext: any = {};
            await AuthService.forgetPassword({
                email: "nobody_exists_here@example.com",
                recaptchaToken: "bypass",
                clientIp: TEST_IP,
                requestId: crypto.randomUUID(),
                userAgent: "TestAgent",
                logContext
            });

            assertEquals(logContext.authEvent, "forget_password_user_not_found");
        });
    });
    describe("getProfile (Lazy Evaluation)", () => {
        let testUserId: string;
        let testTenantId: string;

        beforeAll(async () => {
            // 1. Create a real auth.user via Supabase Admin to satisfy foreign keys
            const email = `profile_test_${crypto.randomUUID()}@example.com`;
            const { data, error } = await supabase.auth.admin.createUser({
                email: email,
                password: "StrongPassword123!",
                email_confirm: true,
            });
            if (error || !data.user) throw new Error("Failed to create test user: " + error?.message);
            
            testUserId = data.user.id;
            testTenantId = crypto.randomUUID();

            // 2. Provision tenants and users tables manually (since the trigger might not fire properly in test environment)
            await db.insert(tenants).values({
                id: testTenantId,
                name: "Test Tenant for Profile",
            }).onConflictDoNothing();

            await db.insert(users).values({
                id: testUserId,
                tenantId: testTenantId,
                email: email,
            }).onConflictDoNothing();
        });

        afterAll(async () => {
            await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
            await db.delete(users).where(eq(users.id, testUserId));
            await db.delete(tenants).where(eq(tenants.id, testTenantId));
            await supabase.auth.admin.deleteUser(testUserId);
        });

        it("positive: returns profile and leaves active subscription untouched", async () => {
            // Setup active subscription (+1 day)
            await db.insert(tenantSubscriptions).values({
                tenantId: testTenantId,
                tier: "PRO",
                expiresAt: new Date(Date.now() + 86400000), 
            });

            const result = await AuthService.getProfile({
                userId: testUserId,
                tenantId: testTenantId,
            });

            assertEquals(result.subscription.tier, "PRO");
            assertExists(result.subscription.expiresAt);

            // Cleanup for next test
            await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
        });

        it("positive: lazy downgrades expired subscription to FREE", async () => {
            // Setup expired subscription (-1 day)
            await db.insert(tenantSubscriptions).values({
                tenantId: testTenantId,
                tier: "SIMULATE",
                expiresAt: new Date(Date.now() - 86400000),
            });

            const logContext: any = {};
            const result = await AuthService.getProfile({
                userId: testUserId,
                tenantId: testTenantId,
                logContext,
            });

            // Validate response is downgraded
            assertEquals(result.subscription.tier, "FREE");
            assertEquals(result.subscription.expiresAt, null);

            // Validate log context recorded the event
            assertEquals(logContext.authEvent, "tier_auto_downgraded");
            assertEquals(logContext.oldTier, "SIMULATE");

            // Validate DB actually updated
            const [dbSub] = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
            assertEquals(dbSub.tier, "FREE");
            assertEquals(dbSub.expiresAt, null);
            
            // Cleanup
            await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
        });
        
        it("negative: throws NOT_FOUND if user does not exist", async () => {
            await assertRejects(
                () => AuthService.getProfile({
                    userId: crypto.randomUUID(), // fake id
                    tenantId: testTenantId,
                }),
                AppError,
                "User not found"
            );
        });
    });
});
