import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { registerUser, loginUser, logoutUser, forgetPassword } from "./auth.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import { users, loginAttempts } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin } from "../../config/supabase.ts";

describe("AuthService Isolated Tests", () => {
    const TEST_EMAIL = "isolated_test@example.com";
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
            await registerUser({
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
                () => registerUser({
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
                () => loginUser({
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
            await forgetPassword({
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
            await forgetPassword({
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
});
