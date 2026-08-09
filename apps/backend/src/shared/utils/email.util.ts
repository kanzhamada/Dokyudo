import { resend } from "../../config/resend.ts";
import { AppError } from "./errors.util.ts";

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
