import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects } from "jsr:@std/assert";
import {
    sendVerificationEmail,
    sendRecoveryEmail,
    sendPaymentSuccessEmail,
    sendWelcomeEmailOnce,
    sendAccountDeletedEmail,
} from "./email.util.ts";
import { resend } from "../../config/resend.ts";
import { redis } from "../../config/redis.ts";
import { Redis } from "@upstash/redis";
import { AppError } from "./errors.util.ts";

describe("Email Utility", () => {
    let originalResendSend: any;
    let originalProtoSet: any;
    let originalProtoDel: any;
    const redisStore = new Map<string, string>();
    let lastSendPayload: any;
    let mockError: Error | null = null;

    beforeAll(() => {
        originalResendSend = resend.emails.send;
        originalProtoSet = Redis.prototype.set;
        originalProtoDel = Redis.prototype.del;

        // @ts-ignore - Mock Redis.prototype.set with NX support for isolated unit tests
        Redis.prototype.set = async function (key: string, value: string, options?: any) {
            if (options?.nx && redisStore.has(key)) {
                return null;
            }
            redisStore.set(key, value);
            return "OK";
        };

        // @ts-ignore - Mock Redis.prototype.del for isolated unit tests
        Redis.prototype.del = async function (...keys: string[]) {
            let count = 0;
            for (const key of keys) {
                if (redisStore.delete(key)) count++;
            }
            return count;
        };

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
        Redis.prototype.set = originalProtoSet;
        Redis.prototype.del = originalProtoDel;
    });

    async function withProductionEnv(fn: () => Promise<void>) {
        const previous = Deno.env.get("NODE_ENV");
        Deno.env.set("NODE_ENV", "production");
        try {
            await fn();
        } finally {
            if (previous === undefined) Deno.env.delete("NODE_ENV");
            else Deno.env.set("NODE_ENV", previous);
        }
    }

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
            
            await withProductionEnv(async () => {
                await assertRejects(
                    () => sendVerificationEmail("test@example.com", "https://verify.me", "user-123", "req-123"),
                    AppError,
                    "Failed to send verification email"
                );
            });
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
            
            await withProductionEnv(async () => {
                await assertRejects(
                    () => sendRecoveryEmail("recover@example.com", "https://recover.me", "123456", "req-456"),
                    AppError,
                    "Failed to send recovery email"
                );
            });
        });
    });

    describe("sendPaymentSuccessEmail", () => {
        it("positive: includes plan, formatted amount, date and idempotency key", async () => {
            mockError = null;
            lastSendPayload = null;

            await sendPaymentSuccessEmail({
                email: "buyer@example.com",
                planName: "Pro Real",
                amountMinor: 58000,
                currency: "IDR",
                paidAt: new Date("2026-08-13T07:00:00.000Z"),
                dashboardUrl: "https://dokyudo.my.id/app?billing=open",
                externalId: "dokyudo-tenant-123-1750000000000",
            });

            const html = lastSendPayload.payload.html.replace(/\u00A0/g, " ");
            assertEquals(lastSendPayload.payload.to, ["buyer@example.com"]);
            assertEquals(lastSendPayload.payload.subject.includes("Pro Real"), true);
            assertEquals(html.includes("Payment successful"), true);
            assertEquals(html.includes("Pro Real"), true);
            assertEquals(html.includes("Rp 58.000,00"), true);
            assertEquals(html.includes("Aug 13, 2026"), true);
            assertEquals(html.includes("https://dokyudo.my.id/app?billing=open"), true);
            assertEquals(
                lastSendPayload.options.idempotencyKey,
                "payment-success/dokyudo-tenant-123-1750000000000"
            );
        });

        it("positive: escapes user-controlled plan name in the email body", async () => {
            mockError = null;
            lastSendPayload = null;

            await sendPaymentSuccessEmail({
                email: "buyer@example.com",
                planName: "Pro <script>alert(1)</script>",
                amountMinor: 1000,
                currency: "USD",
                paidAt: new Date(),
                dashboardUrl: "https://dokyudo.my.id/app?billing=open",
                externalId: "escape-test-1",
            });

            const html = lastSendPayload.payload.html.replace(/\u00A0/g, " ");
            assertEquals(html.includes("<script>"), false);
            assertEquals(html.includes("&lt;script&gt;"), true);
            // USD is a two-decimal currency: 1000 minor units = US$10.00.
            assertEquals(html.includes("US$10,00"), true);
        });

        it("negative: throws AppError when resend fails", async () => {
            mockError = new Error("Resend API down");

            await withProductionEnv(async () => {
                await assertRejects(
                    () =>
                        sendPaymentSuccessEmail({
                            email: "buyer@example.com",
                            planName: "Pro Real",
                            amountMinor: 58000,
                            currency: "IDR",
                            paidAt: new Date(),
                            dashboardUrl: "https://dokyudo.my.id/app?billing=open",
                            externalId: "fail-test-1",
                        }),
                    AppError,
                    "Failed to send payment success email"
                );
            });
        });
    });

    describe("sendWelcomeEmailOnce", () => {
        const userId = `welcome-test-${crypto.randomUUID()}`;
        const markerKey = `welcome_email:${userId}`;

        afterAll(async () => {
            await redis.del(markerKey);
        });

        it("positive: sends the welcome email with correct payload and idempotency key", async () => {
            mockError = null;
            lastSendPayload = null;

            const sent = await sendWelcomeEmailOnce({
                email: "newbie@example.com",
                userId,
                requestId: "req-welcome",
                provider: "google",
            });

            assertEquals(sent, true);
            assertEquals(lastSendPayload.payload.to, ["newbie@example.com"]);
            assertEquals(lastSendPayload.payload.subject.includes("Welcome"), true);
            assertEquals(lastSendPayload.payload.html.includes("google"), true);
            assertEquals(lastSendPayload.payload.html.includes("Get Started"), true);
            assertEquals(
                lastSendPayload.options.idempotencyKey,
                `welcome-email/${userId}`
            );
        });

        it("positive: skips the second welcome for the same user (marker claimed)", async () => {
            mockError = null;
            lastSendPayload = null;

            const sent = await sendWelcomeEmailOnce({
                email: "newbie@example.com",
                userId,
                requestId: "req-welcome-2",
            });

            assertEquals(sent, false);
            assertEquals(lastSendPayload, null);
        });

        it("negative: throws AppError when resend fails and releases the marker", async () => {
            mockError = new Error("Resend API down");
            const failUserId = `welcome-fail-${crypto.randomUUID()}`;
            const failMarkerKey = `welcome_email:${failUserId}`;

            try {
                await withProductionEnv(async () => {
                    await assertRejects(
                        () =>
                            sendWelcomeEmailOnce({
                                email: "fail@example.com",
                                userId: failUserId,
                                requestId: "req-welcome-fail",
                            }),
                        AppError,
                        "Failed to send welcome email"
                    );
                });
            } finally {
                await redis.del(failMarkerKey);
            }

            // Marker released on failure — a retry can re-claim it.
            mockError = null;
            lastSendPayload = null;
            const retried = await sendWelcomeEmailOnce({
                email: "fail@example.com",
                userId: failUserId,
                requestId: "req-welcome-fail-2",
            });
            assertEquals(retried, true);
            assertEquals(lastSendPayload.payload.to, ["fail@example.com"]);
            await redis.del(failMarkerKey);
        });
    });

    describe("sendAccountDeletedEmail", () => {
        it("positive: sends account deleted email with reference ID and idempotency key", async () => {
            mockError = null;
            lastSendPayload = null;

            await sendAccountDeletedEmail({
                email: "deleted-user@example.com",
                jobId: "job-del-12345",
            });

            assertEquals(lastSendPayload.payload.to, ["deleted-user@example.com"]);
            assertEquals(lastSendPayload.payload.subject.includes("deleted"), true);
            assertEquals(lastSendPayload.payload.html.includes("job-del-12345"), true);
            assertEquals(lastSendPayload.payload.html.includes("deleted-user@example.com"), true);
            assertEquals(lastSendPayload.options.idempotencyKey, "account-deleted/job-del-12345");
        });

        it("negative: throws AppError in production if Resend API fails", async () => {
            mockError = new Error("Resend server down");

            await withProductionEnv(async () => {
                await assertRejects(
                    () =>
                        sendAccountDeletedEmail({
                            email: "deleted-user@example.com",
                            jobId: "job-del-12345",
                        }),
                    AppError,
                    "Failed to send account deletion confirmation email",
                );
            });
        });
    });
});
