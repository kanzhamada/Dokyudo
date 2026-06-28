import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { sendVerificationEmail, sendRecoveryEmail } from "./email.util.ts";
import { resend } from "../../config/resend.ts";
import { AppError } from "./errors.util.ts";

describe("Email Utility", () => {
    let originalResendSend: any;
    let lastSendPayload: any;
    let mockError: Error | null = null;

    beforeAll(() => {
        originalResendSend = resend.emails.send;
        // Mock resend.emails.send
        // @ts-ignore - Bypass strict Resend types for mocking
        resend.emails.send = async (payload: any, options: any) => {
            if (mockError) {
                return { data: null, error: mockError };
            }
            lastSendPayload = { payload, options };
            return { data: { id: "test-id" }, error: null };
        };
    });

    afterAll(() => {
        resend.emails.send = originalResendSend;
    });

    describe("sendVerificationEmail", () => {
        it("positive: calls resend with correct parameters", async () => {
            mockError = null;
            lastSendPayload = null;
            
            await sendVerificationEmail("test@example.com", "https://verify.me", "user-123", "req-123");
            
            assertEquals(lastSendPayload.payload.to, ["test@example.com"]);
            assertEquals(lastSendPayload.payload.subject.includes("Verify"), true);
            assertEquals(lastSendPayload.payload.html.includes("https://verify.me"), true);
            assertEquals(lastSendPayload.options.idempotencyKey, "register-email/user-123-req-123");
        });

        it("negative: throws AppError when resend fails", async () => {
            mockError = new Error("Resend API down");
            
            await assertRejects(
                () => sendVerificationEmail("test@example.com", "https://verify.me", "user-123", "req-123"),
                AppError,
                "Failed to send verification email"
            );
        });
    });

    describe("sendRecoveryEmail", () => {
        it("positive: calls resend with correct parameters", async () => {
            mockError = null;
            lastSendPayload = null;
            
            await sendRecoveryEmail("recover@example.com", "https://recover.me", "123456", "req-456");
            
            assertEquals(lastSendPayload.payload.to, ["recover@example.com"]);
            assertEquals(lastSendPayload.payload.subject.includes("Reset"), true);
            assertEquals(lastSendPayload.payload.html.includes("123456"), true); // OTP included
            assertEquals(lastSendPayload.payload.html.includes("https://recover.me"), true); // Link included
            assertEquals(lastSendPayload.options.idempotencyKey, "recovery-email/recover@example.com-req-456");
        });

        it("negative: throws AppError when resend fails", async () => {
            mockError = new Error("Resend rate limited");
            
            await assertRejects(
                () => sendRecoveryEmail("recover@example.com", "https://recover.me", "123456", "req-456"),
                AppError,
                "Failed to send recovery email"
            );
        });
    });
});
