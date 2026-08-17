import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { AuthService } from "./auth.service.ts";
import * as AuthSchema from "./auth.schema.ts";
import { type Context } from "hono";
import { getCookie } from "hono/cookie";
import {
  ACCESS_TOKEN_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from "../../config/cookie.ts";
import { resolveSession } from "../../shared/middlewares/auth.middleware.ts";

export async function handleRegister(c: Context) {
  const extractor = new ContextExtractor(c);
  const { requestId, clientIp, userAgent, logContext } = extractor
    .extractAuditContext();
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
  const { requestId, clientIp, userAgent, logContext } = extractor
    .extractAuditContext();
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

  setSessionCookies(
    c,
    authData.session.access_token,
    authData.session.refresh_token,
  );

  return c.json(
    {
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
  const { requestId, clientIp, userAgent, logContext } = extractor
    .extractAuditContext();
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

  setSessionCookies(
    c,
    authData.session.access_token,
    authData.session.refresh_token,
  );

  return c.json(
    {
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

  // Read the token from the cookie first, then fall back to the header.
  const authHeader = c.req.header("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : (getCookie(c, ACCESS_TOKEN_COOKIE) ?? "");

  // Always clear the session cookies regardless of the revoke result.
  clearSessionCookies(c);

  if (!accessToken) {
    return c.json({ message: "Successfully logged out" }, 200);
  }

  const params: AuthSchema.LogoutParams = {
    accessToken,
    logContext,
  };

  await AuthService.logoutUser(params);

  return c.json({ message: "Successfully logged out" }, 200);
}

export async function handleSession(c: Context) {
  const session = await resolveSession(c);

  if (!session) {
    return c.json({ authenticated: false, user: null }, 200);
  }

  return c.json(
    {
      authenticated: true,
      user: {
        id: session.userId,
        email: session.email,
      },
    },
    200,
  );
}

export async function handleForgetPassword(c: Context) {
  const extractor = new ContextExtractor(c);
  const { requestId, clientIp, userAgent, logContext } = extractor
    .extractAuditContext();
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
  const { requestId, clientIp, userAgent, logContext } = extractor
    .extractAuditContext();
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

  const authHeader = c.req.header("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : (getCookie(c, ACCESS_TOKEN_COOKIE) ?? "");

  const body = extractor.extractValidJson<AuthSchema.UpdatePasswordBody>();

  const params: AuthSchema.UpdatePasswordParams = {
    accessToken,
    newPassword: body.newPassword,
    logContext,
  };

  await AuthService.updatePassword(params);

  // Force re-login: clear the session cookies (the service already revokes
  // the Supabase session globally).
  clearSessionCookies(c);

  return c.json(
    { message: "Password successfully updated. Please log in again." },
    200,
  );
}

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
