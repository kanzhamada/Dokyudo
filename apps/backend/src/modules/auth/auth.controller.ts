import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { AuthService } from "./auth.service.ts";
import * as AuthSchema from "./auth.schema.ts";
import { type Context } from "hono";
import { AppError } from "../../shared/utils/errors.util.ts";

export async function handleRegister(c: Context) {
    const extractor = new ContextExtractor(c);
    const { requestId, clientIp, userAgent, logContext } =
        extractor.extractAuditContext();
    const body = extractor.extractValidJson<AuthSchema.RegisterBody>();

    const params: AuthSchema.RegisterParams = {
        email: body.email,
        password: body.password,
        recaptchaToken: body.recaptchaToken,
        clientIp,
        userAgent,
        requestId,
        logContext,
    };

    await AuthService.registerUser(params);

    return c.json(
        {
            message:
                "Registration successful, please check your email for verification",
        },
        201,
    );
}

export async function handleVerifyEmail(c: Context) {
    const extractor = new ContextExtractor(c);
    const { requestId, clientIp, userAgent, logContext } =
        extractor.extractAuditContext();
    const body = extractor.extractValidJson<AuthSchema.VerifyEmailBody>();

    const params: AuthSchema.VerifyEmailParams = {
        tokenHash: body.tokenHash,
        type: body.type,
        clientIp,
        userAgent,
        requestId,
        logContext,
    };

    const authData = await AuthService.verifyEmail(params);

    return c.json(
        {
            accessToken: authData.session.access_token,
            refreshToken: authData.session.refresh_token,
            user: {
                id: authData.user.id,
                email: authData.user.email!,
            },
        },
        200,
    );
}

export async function handleLogin(c: Context) {
    const extractor = new ContextExtractor(c);
    const { requestId, clientIp, userAgent, logContext } =
        extractor.extractAuditContext();
    const body = extractor.extractValidJson<AuthSchema.LoginBody>();

    const params: AuthSchema.LoginParams = {
        email: body.email,
        password: body.password,
        recaptchaToken: body.recaptchaToken,
        clientIp,
        userAgent,
        requestId,
        logContext,
    };

    const authData = await AuthService.loginUser(params);

    return c.json(
        {
            accessToken: authData.session.access_token,
            refreshToken: authData.session.refresh_token,
            user: {
                id: authData.user.id,
                email: authData.user.email!,
            },
        },
        200,
    );
}

export async function handleLogout(c: Context) {
    const extractor = new ContextExtractor(c);
    const { logContext } = extractor.extractBaseContext();
    const accessToken = extractor.extractBearerToken();

    const params: AuthSchema.LogoutParams = {
        accessToken,
        logContext,
    };

    await AuthService.logoutUser(params);

    return c.json({ message: "Successfully logged out" }, 200);
}

export async function handleForgetPassword(c: Context) {
    const extractor = new ContextExtractor(c);
    const { requestId, clientIp, userAgent, logContext } =
        extractor.extractAuditContext();
    const body = extractor.extractValidJson<AuthSchema.ForgetPasswordBody>();

    const params: AuthSchema.ForgetPasswordParams = {
        email: body.email,
        recaptchaToken: body.recaptchaToken,
        clientIp,
        userAgent,
        requestId,
        logContext,
    };

    await AuthService.forgetPassword(params);

    return c.json(
        { message: "If an account exists, a recovery email has been sent." },
        200,
    );
}

export async function handleResetPassword(c: Context) {
    const extractor = new ContextExtractor(c);
    const { requestId, clientIp, userAgent, logContext } =
        extractor.extractAuditContext();
    const body = extractor.extractValidJson<AuthSchema.ResetPasswordBody>();

    const params: AuthSchema.ResetPasswordParams = {
        email: body.email,
        otp: body.otp,
        newPassword: body.newPassword,
        clientIp,
        userAgent,
        requestId,
        logContext,
    };

    await AuthService.resetPassword(params);

    return c.json(
        { message: "Password has been successfully reset. Please log in." },
        200,
    );
}

export async function handleUpdatePassword(c: Context) {
    const extractor = new ContextExtractor(c);
    const { logContext } = extractor.extractBaseContext();
    const accessToken = extractor.extractBearerToken();
    const body = extractor.extractValidJson<AuthSchema.UpdatePasswordBody>();

    const params: AuthSchema.UpdatePasswordParams = {
        accessToken,
        newPassword: body.newPassword,
        logContext,
    };

    await AuthService.updatePassword(params);

    return c.json(
        { message: "Password successfully updated. Please log in again." },
        200,
    );
}

export const handleGetProfile = async (c: Context) => {
    const userId = c.get("userId");
    const tenantId = c.get("tenantId");
    
    if (!userId || !tenantId) {
        throw new AppError({
            code: "UNAUTHORIZED",
            message: "Missing authentication context",
            status: 401,
        });
    }

    const logContext = c.get("logContext") || {};
    
    const profile = await AuthService.getProfile({
        userId,
        tenantId,
        logContext,
    });
    
    return c.json(profile, 200);
};

export const handleUpdateTenantName = async (c: Context) => {
    const extractor = new ContextExtractor(c);
    const { userId, tenantId, logContext } = extractor.extractAuthContext();
    const { clientIp, userAgent } = extractor.extractAuditContext();
    const body = extractor.extractValidJson<AuthSchema.UpdateTenantNameBody>();

    const result = await AuthService.updateTenantName({
        userId,
        tenantId,
        name: body.name,
        clientIp,
        userAgent,
        logContext,
    });

    return c.json(result, 200);
};
