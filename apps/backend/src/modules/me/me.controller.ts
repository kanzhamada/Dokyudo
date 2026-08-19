import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { MeService } from "./me.service.ts";
import { ACCESS_TOKEN_COOKIE, clearSessionCookies } from "../../config/cookie.ts";
import { getCookie } from "hono/cookie";
import { type Context } from "hono";
import * as MeSchema from "./me.schema.ts";

export async function handleGetProfile(c: Context) {
  const extractor = new ContextExtractor(c);
  const { userId, tenantId, logContext } = extractor.extractAuthContext();

  const profile = await MeService.getProfile({
    userId,
    tenantId,
    logContext,
  });

  return c.json(profile, 200);
}

export async function handleGetUsage(c: Context) {
  const extractor = new ContextExtractor(c);
  const { userId, tenantId, logContext } = extractor.extractAuthContext();

  const usage = await MeService.getUsage({
    userId,
    tenantId,
    logContext,
  });

  return c.json(usage, 200);
}

export const handleDeleteAccount = async (c: Context) => {
  const extractor = new ContextExtractor(c);
  const { userId, tenantId, logContext } = extractor.extractAuthContext();
  const { requestId, clientIp, userAgent } = extractor.extractAuditContext();

  const result = await MeService.requestAccountDeletion({
    userId,
    tenantId,
    clientIp,
    userAgent,
    requestId,
    logContext,
  });

  // The account is now deletion_pending — drop the local session cookies
  // immediately so the client does not keep calling the API with a dead token.
  clearSessionCookies(c);

  return c.json(
    {
      message: "Account deletion scheduled. Your data will be purged shortly.",
      scheduled: result.scheduled,
      jobId: result.jobId,
    },
    202,
  );
};

export async function handleUpdatePassword(c: Context) {
  const extractor = new ContextExtractor(c);
  const { logContext } = extractor.extractBaseContext();

  const authHeader = c.req.header("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : (getCookie(c, ACCESS_TOKEN_COOKIE) ?? "");

  const body = extractor.extractValidJson<MeSchema.UpdatePasswordBody>();

  const params: MeSchema.UpdatePasswordParams = {
    accessToken,
    newPassword: body.newPassword,
    logContext,
  };

  await MeService.updatePassword(params);

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
  const body = extractor.extractValidJson<MeSchema.UpdateTenantNameBody>();

  const result = await MeService.updateTenantName({
    userId,
    tenantId,
    name: body.name,
    clientIp,
    userAgent,
    logContext,
  });

  return c.json(result, 200);
};
