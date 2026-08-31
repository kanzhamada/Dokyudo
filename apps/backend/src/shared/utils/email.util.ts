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

// ---------------------------------------------------------------------------
// Dokyudo email design system — derived from `apps/frontend/src/lib/assets/landing.css`
// and `fe-poc/DESIGN.md`.
//
// Palette: black #0E0E0E / offblack #1A1616 / offwhite #FAFAFA / white #FFFFFF
//          orange #F04E23 (primary action, 200ms ease) / graphite #3E3E3E
//          gray #676767 / warm-gray #9C9996 / ash #D9D9D9
//          border: 1px solid rgba(185,185,185,0.4) → #E8E8E8 fallback
// Type: display Gambetta/Reckless → Georgia, interface Chillax/FG Futurist → Trebuchet,
//       body Plus Jakarta Sans/Ease → Helvetica. Cards 0px radius, controls 8px,
//       pills 9999px. Email-safe: table layout, all styles inline, 600px container.
// ---------------------------------------------------------------------------

function emailShell(params: {
    preheader: string;
    kicker: string;
    title: string;
    introHtml: string;
    bodyHtml?: string;
    cta?: { label: string; url: string };
    fallbackUrl?: string;
    footerNote?: string;
}): string {
    const { preheader, kicker, title, introHtml, bodyHtml = "", cta, fallbackUrl, footerNote } = params;

    const ctaRow = cta
        ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px;">
                        <tr>
                            <td align="center" style="border-radius:8px; background:#F04E23;">
                                <a href="${cta.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:13px 24px; font-family:'Plus Jakarta Sans','Ease Standard','Helvetica Neue',Helvetica,Arial,sans-serif; font-size:14px; font-weight:700; line-height:1; color:#0E0E0E; text-decoration:none; border-radius:8px;">
                                    ${escapeHtml(cta.label)}
                                </a>
                            </td>
                        </tr>
                    </table>`
        : "";

    const fallbackRow = fallbackUrl
        ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;">
                        <tr>
                            <td style="background:#FAFAFA; border:1px solid #E8E8E8; padding:12px 14px;">
                                <div style="font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:10px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:#9C9996; margin-bottom:6px;">Or copy &amp; paste this link</div>
                                <a href="${fallbackUrl}" style="font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:12px; line-height:1.5; color:#F04E23; word-break:break-all; text-decoration:underline;">${escapeHtml(fallbackUrl)}</a>
                            </td>
                        </tr>
                    </table>`
        : "";

    const footerNoteRow = footerNote
        ? `<p style="margin:18px 0 0; font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:12px; line-height:1.6; color:#9C9996;">${footerNote}</p>`
        : "";

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#FAFAFA; -webkit-font-smoothing:antialiased;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:#FAFAFA;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%; max-width:600px; border-collapse:separate;">
<tr>
<td style="background-color:#0E0E0E; padding:18px 28px; border:1px solid #1A1616; border-bottom:none;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td align="left">
<span style="font-family:'Gambetta','Reckless Standard',Georgia,'Times New Roman',serif; font-size:18px; font-weight:500; letter-spacing:-0.02em; color:#FAFAFA; line-height:1;">Dokyudo</span>
<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#F04E23; margin-left:8px; vertical-align:middle;"></span>
</td>
<td align="right" style="font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:9px; font-weight:500; letter-spacing:0.14em; text-transform:uppercase; color:rgba(250,250,250,0.6);">
Secure&nbsp;·&nbsp;Document&nbsp;Intelligence
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="background-color:#FFFFFF; border:1px solid #E8E8E8; border-top:none; padding:28px 28px 26px;">
<div style="display:inline-block; padding:6px 10px; border-radius:9999px; background:#FFF3EE; border:1px solid #FCDACF; font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:10px; font-weight:500; letter-spacing:0.14em; text-transform:uppercase; color:#F04E23; line-height:1;">${escapeHtml(kicker)}</div>
<h1 style="margin:16px 0 0; font-family:'Gambetta','Reckless Standard',Georgia,'Times New Roman',serif; font-size:26px; font-weight:400; line-height:1.1; letter-spacing:-0.02em; color:#0E0E0E;">${escapeHtml(title)}</h1>
<div style="margin-top:3px; width:28px; height:2px; background:#F04E23;"></div>
<p style="margin:14px 0 0; font-family:'Plus Jakarta Sans','Ease Standard','Helvetica Neue',Helvetica,Arial,sans-serif; font-size:14px; line-height:1.6; color:#3E3E3E;">${introHtml}</p>
${bodyHtml}
${ctaRow}
${fallbackRow}
${footerNoteRow}
</td>
</tr>
<tr>
<td style="padding:18px 8px 0; text-align:center;">
<p style="margin:0; font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:11px; line-height:1.6; color:#9C9996;">
Dokyudo · Secure document intelligence · <a href="https://dokyudo.my.id" style="color:#9C9996; text-decoration:underline;">dokyudo.my.id</a>
</p>
<p style="margin:6px 0 0; font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:10px; letter-spacing:0.06em; color:#B9B9B9;">
This email was sent to you as a transactional notification. Please do not reply directly.
</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Sends the one-time welcome email ("your account is ready") for a
 * newly verified user (upon email verification link/OTP or first-time OAuth login).
 * Returns false when the welcome was already sent for this user; true when it
 * was sent (or skipped in non-prod after a Resend error). Never throws on
 * marker/redis failures — the marker is best-effort.
 */
export async function sendWelcomeEmailOnce(params: {
    email: string;
    userId: string;
    requestId: string;
    provider?: string;
    logContext?: Record<string, any>;
}): Promise<boolean> {
    const { email, userId, requestId, provider, logContext } = params;
    const markerKey = `welcome_email:${userId}`;

    let claimed = false;
    try {
        claimed = (await redis.set(markerKey, "1", {
            nx: true,
            ex: WELCOME_EMAIL_MARKER_TTL_SECONDS,
        })) === "OK";
    } catch (err: any) {
        if (logContext) logContext.emailMarkerError = err.message;
        return false;
    }
    if (!claimed) return false;

    const providerLine = provider
        ? ` Your account was created with <strong style="color:#0E0E0E;">${escapeHtml(provider)}</strong>.`
        : "";

    const perks = [
        "Upload documents — PDF, DOCX, TXT to your library",
        "Ask questions about your documents with RAG Q&A",
        "Search across your knowledge base with hybrid semantic search",
    ].map((text) => `
                        <tr>
                            <td style="width:22px; vertical-align:top; padding:6px 0;">
                                <span style="display:inline-block; width:18px; height:18px; line-height:18px; text-align:center; border-radius:50%; background:#F04E23; color:#FFFFFF; font-size:10px; font-weight:700;">✓</span>
                            </td>
                            <td style="padding:6px 0 6px 8px; font-family:'Plus Jakarta Sans','Ease Standard','Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13.5px; line-height:1.5; color:#3E3E3E;">${escapeHtml(text)}</td>
                        </tr>`).join("");

    const welcomeHtml = emailShell({
        preheader: "Your Dokyudo account is verified — get started with document search and RAG Q&A.",
        kicker: "Account ready",
        title: "Welcome to Dokyudo",
        introHtml: `Thanks for joining Dokyudo — your account has been verified successfully.${providerLine}`,
        bodyHtml: `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 8px;">
                        ${perks}
                    </table>`,
        cta: { label: "Get Started", url: getEnv("FRONTEND_URL") },
        footerNote: "This is an automated notification — please do not reply to this email.",
    });

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: "Welcome to Dokyudo — your account is ready",
            html: welcomeHtml,
        },
        {
            // One welcome per user, forever — retries never double-send.
            idempotencyKey: `welcome-email/${userId}`,
        },
    );

    if (error) {
        if (logContext) logContext.emailError = error.message;
        // Release the marker so a later login/registration can retry.
        try {
            await redis.del(markerKey);
        } catch {
            // Best-effort marker release.
        }
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
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
    logContext?: Record<string, any>,
) {
    const html = emailShell({
        preheader: "Verify your email address to activate your Dokyudo account.",
        kicker: "Verify your email",
        title: "Confirm your address",
        introHtml: "Thank you for signing up. Please verify your email address to activate your workspace.",
        bodyHtml: "",
        cta: { label: "Verify Email Address", url: actionLink },
        fallbackUrl: actionLink,
        footerNote: "If you did not request this, please ignore this email.",
    });

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: "Verify your email address - Dokyudo",
            html,
        },
        {
            // Idempotency key to prevent sending multiple emails for the same signup attempt (retry logic)
            // Incorporating requestId ensures that if the user legitimately requests a new link, it will send a new email.
            idempotencyKey: `register-email/${userId}-${requestId}`,
        },
    );

    if (error) {
        if (logContext) logContext.emailError = error.message;
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
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
    logContext?: Record<string, any>,
) {
    const otpBlock = `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;">
                        <tr>
                            <td align="center" style="background:#FAFAFA; border:1px solid #E8E8E8; padding:18px 16px;">
                                <div style="font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:10px; font-weight:500; letter-spacing:0.14em; text-transform:uppercase; color:#9C9996; margin-bottom:8px;">Your 8-digit OTP</div>
                                <div style="font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:28px; font-weight:700; letter-spacing:6px; color:#0E0E0E; line-height:1;">${escapeHtml(otp)}</div>
                                <div style="margin-top:8px; width:28px; height:2px; background:#F04E23; margin-left:auto; margin-right:auto;"></div>
                                <div style="font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:11px; color:#676767; margin-top:10px;">Expires in 15 minutes · One-time use</div>
                            </td>
                        </tr>
                    </table>`;

    const html = emailShell({
        preheader: "Reset your Dokyudo password — use the 8-digit OTP or the magic link.",
        kicker: "Password reset",
        title: "Reset your password",
        introHtml: "We received a request to reset your password. You can either use the 8-digit OTP below or click the magic link to reset it.",
        bodyHtml: otpBlock,
        cta: { label: "Reset Password via Link", url: actionLink },
        fallbackUrl: actionLink,
        footerNote: "If you did not request a password reset, please ignore this email or contact support if you have concerns.",
    });

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: "Reset your password - Dokyudo",
            html,
        },
        {
            idempotencyKey: `recovery-email/${email}-${requestId}`,
        },
    );

    if (error) {
        if (logContext) logContext.emailError = error.message;
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
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
    logContext?: Record<string, any>;
}) {
    const { email, sharerName, conversationTitle, shareUrl, expiresAt, shareCode, logContext } = params;

    const expiryLine = expiresAt
        ? `This link expires on ${new Date(expiresAt).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
          })}.`
        : "This link never expires.";

    const conversationCard = `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 4px;">
                        <tr>
                            <td style="background:#FAFAFA; border:1px solid #E8E8E8; border-left:3px solid #F04E23; padding:14px 16px;">
                                <div style="font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; color:#0E0E0E; line-height:1.4;">${escapeHtml(conversationTitle)}</div>
                                <div style="font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:11px; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:#676767; margin-top:6px;">${escapeHtml(expiryLine)}</div>
                            </td>
                        </tr>
                    </table>`;

    const html = emailShell({
        preheader: `${sharerName} shared a conversation with you on Dokyudo.`,
        kicker: "Shared conversation",
        title: "You have been invited to view a conversation",
        introHtml: `${escapeHtml(sharerName)} shared a private conversation with you on Dokyudo:`,
        bodyHtml: conversationCard,
        cta: { label: "View Conversation", url: shareUrl },
        fallbackUrl: shareUrl,
        footerNote: `You are receiving this email because ${escapeHtml(sharerName)} invited you to view this private conversation on Dokyudo.`,
    });

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: `${sharerName} shared a conversation with you on Dokyudo`,
            html,
        },
        {
            // One idempotent email per invitee per share — retries never double-send.
            idempotencyKey: `share-invite/${shareCode}/${email}`,
        },
    );

    if (error) {
        if (logContext) logContext.emailError = error.message;
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
            return;
        }
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send share invite email. Please try again.",
            status: 500,
        });
    }
}

export async function sendPaymentSuccessEmail(params: {
    email: string;
    planName: string;
    amountMinor: number;
    currency: string;
    paidAt: Date;
    dashboardUrl: string;
    externalId: string;
    logContext?: Record<string, any>;
}) {
    const { email, planName, amountMinor, currency, paidAt, dashboardUrl, externalId, logContext } = params;

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
            <td style="padding:10px 0; border-bottom:1px solid #E8E8E8; font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:11px; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:#9C9996; white-space:nowrap;">${label}</td>
            <td style="padding:10px 0; border-bottom:1px solid #E8E8E8; font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; color:#0E0E0E; text-align:right;">${value}</td>
        </tr>
    `;

    const summaryTable = `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0; background:#FAFAFA; border:1px solid #E8E8E8; border-collapse:collapse;">
                        <tr><td style="padding:10px 16px 4px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                                ${summaryRow("Plan", escapeHtml(planName))}
                                ${summaryRow("Amount paid", amountLabel)}
                                ${summaryRow("Date", paidAtLabel)}
                                <tr>
                                    <td style="padding:10px 0 6px; font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:11px; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:#9C9996;">Status</td>
                                    <td style="padding:10px 0 6px; text-align:right;"><span style="display:inline-block; padding:4px 10px; border-radius:9999px; background:#E0E07B; color:#0E0E0E; font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase;">Active</span></td>
                                </tr>
                            </table>
                        </td></tr>
                    </table>`;

    const html = emailShell({
        preheader: `Payment confirmed — ${planName} is now active on Dokyudo.`,
        kicker: "Payment confirmed",
        title: "Payment successful",
        introHtml: `Your <strong style="color:#0E0E0E;">${escapeHtml(planName)}</strong> access is now active on Dokyudo. Here is your payment summary:`,
        bodyHtml: summaryTable + `<p style="margin:8px 0 0; font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#676767;">Your billing details and usage are available in the Billing panel inside the app.</p>`,
        cta: { label: "Open Dokyudo", url: dashboardUrl },
        footerNote: "You are receiving this email because a payment was completed on your Dokyudo account. If you did not make this payment, please contact support immediately.",
    });

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: `Payment successful - ${planName} - Dokyudo`,
            html,
        },
        {
            // One email per checkout session — Stripe webhook retries never double-send.
            idempotencyKey: `payment-success/${externalId}`,
        },
    );

    if (error) {
        if (logContext) logContext.emailError = error.message;
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
            return;
        }
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send payment success email. Please try again.",
            status: 500,
        });
    }
}

export async function sendAccountDeletedEmail(params: {
    email: string;
    jobId: string;
    logContext?: Record<string, any>;
}) {
    const { email, jobId, logContext } = params;

    const referenceCard = `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;">
                        <tr>
                            <td style="background:#FAFAFA; border:1px solid #E8E8E8; padding:14px 16px;">
                                <div style="font-family:'Chillax','FG Futurist','Trebuchet MS',sans-serif; font-size:10px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:#9C9996; margin-bottom:6px;">Deletion Reference ID</div>
                                <div style="font-family:'Chillax','FG Futurist','Trebuchet MS',monospace; font-size:13px; font-weight:600; letter-spacing:0.06em; color:#0E0E0E; word-break:break-all;">${escapeHtml(jobId)}</div>
                                <div style="margin-top:10px; height:1px; background:#E8E8E8;"></div>
                                <div style="font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:12px; color:#676767; margin-top:10px; line-height:1.5;">Account <strong style="color:#0E0E0E;">${escapeHtml(email)}</strong> and all associated data have been permanently removed.</div>
                            </td>
                        </tr>
                    </table>`;

    const html = emailShell({
        preheader: "Your Dokyudo account has been permanently deleted.",
        kicker: "Account deleted",
        title: "Account successfully deleted",
        introHtml: `Your Dokyudo account associated with <strong style="color:#0E0E0E;">${escapeHtml(email)}</strong> has been permanently deleted as requested.`,
        bodyHtml: `<p style="margin:12px 0 0; font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#3E3E3E;">All your documents, conversations, search history, API keys, and active subscriptions have been completely removed from our systems.</p>${referenceCard}<p style="margin:0; font-family:'Plus Jakarta Sans','Ease Standard',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:#676767;">Thank you for using Dokyudo. If you decide to return in the future, you are always welcome to register a new account.</p>`,
        footerNote: "This is an automated confirmation — please do not reply to this email. If you did not request this deletion, please contact support immediately.",
    });

    const { error } = await resend.emails.send(
        {
            from: "Dokyudo <team@dokyudo.my.id>",
            to: [email],
            subject: "Your Dokyudo account has been deleted",
            html,
        },
        {
            // One email per account deletion job — cron retries never double-send.
            idempotencyKey: `account-deleted/${jobId}`,
        },
    );

    if (error) {
        if (logContext) logContext.emailError = error.message;
        if (Deno.env.get("NODE_ENV") === "test" || Deno.env.get("NODE_ENV") === "dev") {
            return;
        }
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send account deletion confirmation email.",
            status: 500,
        });
    }
}
