import { extractClientIp } from "../middlewares/request.middleware.ts";
import * as authService from "../services/auth.service.ts";
import { type Context } from "hono";

export async function handleRegister(c: Context) {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const body = c.req.valid("json" as never) as any;
    const clientIp = extractClientIp(c.req.raw.headers);

    await authService.registerUser({
        email: body.email,
        password: body.password,
        recaptchaToken: body.recaptchaToken,
        clientIp,
        requestId,
    });

    return c.json(
        { message: "Registration successful. Please check your email for verification." },
        201
    );
}

export async function handleLogin(c: Context) {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    const body = c.req.valid("json" as never) as any;
    const clientIp = extractClientIp(c.req.raw.headers);
    const userAgent = c.req.header("user-agent") ?? "unknown";

    const authData = await authService.loginUser({
        email: body.email,
        password: body.password,
        recaptchaToken: body.recaptchaToken,
        clientIp,
        userAgent,
        requestId,
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
