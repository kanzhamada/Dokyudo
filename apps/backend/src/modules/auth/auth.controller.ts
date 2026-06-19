import { extractClientIp } from "../../shared/middlewares/request.middleware.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import * as authService from "./auth.service.ts";
import { type Context } from "hono";

export async function handleRegister(c: Context) {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const body = c.req.valid("json" as never) as any;
    const clientIp = extractClientIp(c.req.raw.headers);

    const logContext = c.get("logContext");

    await authService.registerUser({
        email: body.email,
        password: body.password,
        recaptchaToken: body.recaptchaToken,
        clientIp,
        requestId,
        logContext,
    });

    return c.json(
        { message: "Registration successful, please check your email for verification" },
        201
    );
}

export async function handleLogin(c: Context) {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const body = c.req.valid("json" as never) as any;
    const clientIp = extractClientIp(c.req.raw.headers);
    const userAgent = c.req.header("user-agent") ?? "unknown";

    const logContext = c.get("logContext");

    const authData = await authService.loginUser({
        email: body.email,
        password: body.password,
        recaptchaToken: body.recaptchaToken,
        clientIp,
        userAgent,
        requestId,
        logContext,
    });

    return c.json(
        {
            accessToken: authData.session.access_token,
            refreshToken: authData.session.refresh_token,
            user: {
                id: authData.user.id,
                email: authData.user.email!,
            },
        },
        200
    );
}

export async function handleLogout(c: Context) {
    const authHeader = c.req.header("Authorization");
    const logContext = c.get("logContext");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        if (logContext) {
            logContext.authEvent = "logout_failed";
            logContext.authError = "Missing or invalid authorization token";
        }
        throw new AppError({
            code: "UNAUTHORIZED",
            message: "Missing or invalid authorization token",
            status: 401,
        });
    }

    const accessToken = authHeader.split(" ")[1];

    await authService.logoutUser({
        accessToken,
        logContext,
    });

    return c.json(
        { message: "Successfully logged out" },
        200
    );
}
