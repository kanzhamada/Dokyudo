import { resend } from "../../config/resend.ts";
import { redis } from "../../config/redis.ts";
import { getEnv } from "../../config/env.ts";
import { AppError } from "./errors.util.ts";

/**
 * Atomic claim that a user's welcome email was sent — `SET NX` wins the race
 * across concurrent first logins, and the marker prevents a second welcome
 * if a user re-triggers registration. One year TTL: a lost marker can at
 * worst cause a harmless duplicate notification.
 */
const WELCOME_EMAIL_MARKER_TTL_SECONDS = 60 * 60 * 24 * 365;

/**
 * Sends the one-time welcome email ("your account is registered") for a
 * newly created user. Returns false when the welcome was already sent for
 * this user; true when it was sent (or skipped in non-prod after a Resend
 * error). Never throws on marker/redis failures — the marker is best-effort.
 */
export async function sendWelcomeEmailOnce(params: {
    email: string;
    userId: string;
    requestId: string;
    provider?: string;
}): Promise<boolean> {
    const { email, userId, requestId, provider } = params;
    const markerKey = `welcome_email:${userId}`;

    let claimed = false;
    try {
        claimed = (await redis.set(markerKey, "1", {
            nx: true,
            ex: WELCOME_EMAIL_MARKER_TTL_SECONDS,
        })) === "OK";
    } catch (err: any) {
        console.error(
            "[Welcome Email] Failed to claim marker, skipping:",
            err.message,
        );
        return false;
    }
    if (!claimed) return false;

    const providerLine = provider
        ? ` Your account was created with <strong>${escapeHtml(provider)}</strong>.`
        : "";

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: "Welcome to Dokyudo — your account is ready",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Welcome to Dokyudo!</h2>
                    <p>Thanks for joining Dokyudo — your account has been registered successfully.${providerLine}</p>
                    <p>You can now:</p>
                    <ul style="color: #444; font-size: 14px; line-height: 1.7;">
                        <li>Upload documents (PDF, DOCX, TXT) to your library</li>
                        <li>Ask questions about your documents with AI</li>
                        <li>Search across your knowledge base semantically</li>
                    </ul>
                    <p style="margin: 30px 0; text-align: center;">
                        <a href="${getEnv("FRONTEND_URL")}" style="background-color: #DB8F5E; color: #1F1E1D; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Get Started
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        This is an automated notification — please do not reply to this email.
                    </p>
                </div>
            `,
        },
        {
            // One welcome per user, forever — retries never double-send.
            idempotencyKey: `welcome-email/${userId}`,
        },
    );

    if (error) {
        console.error(
            "Failed to send welcome email via Resend:",
            error.message,
        );
        // Release the marker so a later login/registration can retry.
        try {
            await redis.del(markerKey);
        } catch (delErr: any) {
            console.error(
                "[Welcome Email] Failed to release marker:",
                delErr.message,
            );
        }
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
            console.warn("[TEST/DEV] Bypassing Resend welcome email error in non-production environment.");
            return true;
        }
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send welcome email. Please try again.",
            status: 500,
        });
    }

    return true;
}

export async function sendVerificationEmail(
    email: string,
    actionLink: string,
    userId: string,
    requestId: string,
) {
    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: "Verify your email address - Dokyudo",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Welcome to Dokyudo!</h2>
                    <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
                    <p style="margin: 30px 0;">
                        <a href="${actionLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Verify Email Address
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        If the button above does not work, you can copy and paste this link into your browser:
                        <br/>
                        <a href="${actionLink}">${actionLink}</a>
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        If you did not request this, please ignore this email.
                    </p>
                </div>
            `,
        },
        {
            // Idempotency key to prevent sending multiple emails for the same signup attempt (retry logic)
            // Incorporating requestId ensures that if the user legitimately requests a new link, it will send a new email.
            idempotencyKey: `register-email/${userId}-${requestId}`,
        },
    );

    if (error) {
        console.error(
            "Failed to send verification email via Resend:",
            error.message,
        );
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
            console.warn("[TEST/DEV] Bypassing Resend email error in non-production environment.");
            return;
        }
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send verification email. Please try again.",
            status: 500,
        });
    }
}

export async function sendRecoveryEmail(
    email: string,
    actionLink: string,
    otp: string,
    requestId: string,
) {
    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: "Reset your password - Dokyudo",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2>Password Reset Request</h2>
                    <p>We received a request to reset your password. You can either use the 6-digit OTP below or click the magic link to reset it.</p>

                    <div style="background-color: #f4f4f4; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
                        <h3 style="margin: 0; color: #333;">Your OTP</h3>
                        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #000; margin: 10px 0;">
                            ${otp}
                        </p>
                    </div>

                    <p style="margin: 30px 0; text-align: center;">
                        <a href="${actionLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Reset Password via Link
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        If the button above does not work, you can copy and paste this link into your browser:
                        <br/>
                        <a href="${actionLink}">${actionLink}</a>
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        If you did not request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                </div>
            `,
        },
        {
            idempotencyKey: `recovery-email/${email}-${requestId}`,
        },
    );

    if (error) {
        console.error(
            "Failed to send recovery email via Resend:",
            error.message,
        );
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
            console.warn("[TEST/DEV] Bypassing Resend email error in non-production environment.");
            return;
        }
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send recovery email. Please try again.",
            status: 500,
        });
    }
}

export async function sendShareInviteEmail(params: {
    email: string;
    sharerName: string;
    conversationTitle: string;
    shareUrl: string;
    expiresAt: string | null;
    shareCode: string;
}) {
    const { email, sharerName, conversationTitle, shareUrl, expiresAt, shareCode } = params;

    const expiryLine = expiresAt
        ? `This link expires on ${new Date(expiresAt).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
          })}.`
        : "This link never expires.";

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: `${sharerName} shared a conversation with you on Dokyudo`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1F1E1D;">You have been invited to view a conversation</h2>
                    <p>${escapeHtml(sharerName)} shared a private conversation with you on Dokyudo:</p>
                    <p style="margin: 24px 0;">
                        <a href="${shareUrl}" style="background-color: #DB8F5E; color: #1F1E1D; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            View Conversation
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        If the button above does not work, copy and paste this link into your browser:
                        <br/>
                        <a href="${shareUrl}">${shareUrl}</a>
                    </p>
                    <div style="background-color: #f7f4ef; border: 1px solid #e5ddd2; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                        <p style="margin: 0 0 4px; font-weight: bold; color: #1F1E1D;">${escapeHtml(conversationTitle)}</p>
                        <p style="margin: 0; color: #666; font-size: 13px;">${expiryLine}</p>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-top: 24px;">
                        You are receiving this email because ${escapeHtml(sharerName)} invited you to view this
                        private conversation on Dokyudo.
                    </p>
                </div>
            `,
        },
        {
            // One idempotent email per invitee per share — retries never double-send.
            idempotencyKey: `share-invite/${shareCode}/${email}`,
        },
    );

    if (error) {
        console.error(
            "Failed to send share invite email via Resend:",
            error.message,
        );
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
            console.warn("[TEST/DEV] Bypassing Resend email error in non-production environment.");
            return;
        }
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send share invite email. Please try again.",
            status: 500,
        });
    }
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return entities[character];
    });
}

export async function sendPaymentSuccessEmail(params: {
    email: string;
    planName: string;
    amountMinor: number;
    currency: string;
    paidAt: Date;
    dashboardUrl: string;
    externalId: string;
}) {
    const { email, planName, amountMinor, currency, paidAt, dashboardUrl, externalId } = params;

    // Stripe reports amount_total in the currency's smallest unit. Zero-decimal
    // currencies (IDR, JPY, VND, ...) report whole units, everything else
    // reports cents. Never divide blindly.
    const zeroDecimalCurrencies = new Set([
        "BIF", "CLP", "DJF", "GNF", "IDR", "JPY", "KMF", "KRW", "LAK",
        "PYG", "RWF", "UGX", "UZS", "VND", "VUV", "XAF", "XOF", "XPF",
    ]);
    const amountMajor = zeroDecimalCurrencies.has(currency.toUpperCase())
        ? amountMinor
        : amountMinor / 100;

    // Format defensively — never let an unknown currency code crash the email send.
    let amountLabel: string;
    try {
        amountLabel = new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(amountMajor);
    } catch {
        amountLabel = `${currency.toUpperCase()} ${amountMajor.toFixed(2)}`;
    }

    const paidAtLabel = paidAt.toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    const summaryRow = (label: string, value: string) => `
        <tr>
            <td style="padding: 8px 0; color: #8a8178; font-size: 13px; white-space: nowrap;">${label}</td>
            <td style="padding: 8px 0; color: #1f1e1d; font-size: 13px; font-weight: 600; text-align: right;">${value}</td>
        </tr>
    `;

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: `Payment successful - ${planName} - Dokyudo`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1F1E1D; margin-bottom: 4px;">Payment successful</h2>
                    <p style="color: #666; margin-top: 0;">
                        Your <strong style="color: #1F1E1D;">${escapeHtml(planName)}</strong> access is now active on Dokyudo.
                        Here is your payment summary:
                    </p>

                    <table style="width: 100%; background-color: #f7f4ef; border: 1px solid #e5ddd2; border-radius: 8px; padding: 8px 16px; margin: 20px 0; border-collapse: collapse;">
                        ${summaryRow("Plan", escapeHtml(planName))}
                        ${summaryRow("Amount paid", amountLabel)}
                        ${summaryRow("Date", paidAtLabel)}
                        ${summaryRow("Status", "Active")}
                    </table>

                    <p style="margin: 24px 0; text-align: center;">
                        <a href="${dashboardUrl}" style="background-color: #DB8F5E; color: #1F1E1D; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Open Dokyudo
                        </a>
                    </p>

                    <p style="color: #666; font-size: 14px;">
                        Your billing details and usage are available in the Billing panel inside the app.
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 24px;">
                        You are receiving this email because a payment was completed on your Dokyudo account.
                        If you did not make this payment, please contact support immediately.
                    </p>
                </div>
            `,
        },
        {
            // One email per checkout session — Stripe webhook retries never double-send.
            idempotencyKey: `payment-success/${externalId}`,
        },
    );

    if (error) {
        console.error(
            "Failed to send payment success email via Resend:",
            error.message,
        );
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
            console.warn("[TEST/DEV] Bypassing Resend email error in non-production environment.");
            return;
        }
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send payment success email. Please try again.",
            status: 500,
        });
    }
}
