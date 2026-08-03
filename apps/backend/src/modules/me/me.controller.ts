import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { MeService } from "./me.service.ts";
import { type Context } from "hono";

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
