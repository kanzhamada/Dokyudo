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
        });

        it("negative: rejects duplicate registration for verified user", async () => {
            const { data } = await supabase.auth.admin.listUsers();
            // @ts-ignore - Supabase type mismatch
            const user = data.users.find((u: any) => u.email === TEST_EMAIL);
            if (user) {
                await supabase.auth.admin.updateUserById(user.id, { email_confirm: true });
            }

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
                "An account with this email already exists"
            );
        });
    });

    describe("loginUser", () => {
        it("negative: rejects login for unverified user", async () => {
            const unverifiedEmail = `unverified_${crypto.randomUUID()}@example.com`;
            await AuthService.registerUser({
                email: unverifiedEmail,
                password: "StrongPassword123!",
                recaptchaToken: "bypass",
                clientIp: TEST_IP,
                requestId: crypto.randomUUID(),
                userAgent: "TestAgent",
            });

            await assertRejects(
                () => AuthService.loginUser({
                    email: unverifiedEmail,
                    password: "StrongPassword123!",
                    recaptchaToken: "bypass",
                    clientIp: TEST_IP,
                    requestId: crypto.randomUUID(),
                    userAgent: "TestAgent",
                }),
                AppError,
                "Your email is not verified yet"
            );

            const { data } = await supabase.auth.admin.listUsers();
            // @ts-ignore - Supabase type mismatch
            const u = data.users.find((x: any) => x.email === unverifiedEmail);
            if (u) await supabase.auth.admin.deleteUser(u.id);
        });
    });

    describe("forgetPassword", () => {
        it("positive: processes recovery for existing user", async () => {
            const logContext: any = {};
            await AuthService.forgetPassword({
                email: TEST_EMAIL,
                clientIp: TEST_IP,
                requestId: crypto.randomUUID(),
                userAgent: "TestAgent",
                logContext
            });

            assertEquals(logContext.authEvent, "forget_password_success");
        });

        it("positive: handles non-existing user silently without error", async () => {
            const logContext: any = {};
            await AuthService.forgetPassword({
                email: "nonexistent_email_12345@example.com",
                clientIp: TEST_IP,
                requestId: crypto.randomUUID(),
                userAgent: "TestAgent",
                logContext
            });

            assertEquals(logContext.authEvent, "forget_password_user_not_found");
        });
    });


    describe("verifyEmail", () => {
        it("negative: throws UNAUTHORIZED for invalid or expired tokenHash", async () => {
            const logContext: any = {};
            await assertRejects(
                () =>
                    AuthService.verifyEmail({
                        tokenHash: "invalid_token_hash_12345",
                        type: "signup",
                        clientIp: TEST_IP,
                        userAgent: "TestAgent",
                        requestId: crypto.randomUUID(),
                        logContext,
                    }),
                AppError,
                "Invalid or expired verification link.",
            );
            assertEquals(logContext.authEvent, "verify_email_failed");
        });
    });
});
