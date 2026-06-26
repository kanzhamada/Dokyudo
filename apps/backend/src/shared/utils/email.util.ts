import { resend } from "../../config/resend.ts";
import { AppError } from "./errors.util.ts";

export async function sendVerificationEmail(email: string, actionLink: string, userId: string, requestId: string) {
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
            idempotencyKey: `register-email/${userId}-${requestId}` 
        }
    );

    if (error) {
        console.error("Failed to send verification email via Resend:", error.message);
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to send verification email. Please try again.",
            status: 500,
        });
    }
}
