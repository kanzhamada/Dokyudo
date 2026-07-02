import { Context } from "hono";
import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { KeysService } from "./keys.service.ts";

export class KeysController {
    static async upsertKey(c: Context) {
        const extractor = new ContextExtractor(c);
        const { tenantId, logContext } = extractor.extractAuthContext();
        const body = extractor.extractValidJson<{ provider: string; apiKey: string }>();

        await KeysService.upsertKey({
            tenantId,
            provider: body.provider,
            apiKey: body.apiKey,
            logContext,
        });

        return c.json({ data: { success: true } }, 200);
    }

    static async getKeys(c: Context) {
        const extractor = new ContextExtractor(c);
        const { tenantId, logContext } = extractor.extractAuthContext();
        
        const keys = await KeysService.getKeys({ tenantId, logContext });
        return c.json({ data: keys }, 200);
    }

    static async deleteKey(c: Context) {
        const extractor = new ContextExtractor(c);
        const { tenantId, logContext } = extractor.extractAuthContext();
        const provider = c.req.param("provider");

        await KeysService.deleteKey({ tenantId, provider, logContext });
        return c.json({ data: { success: true } }, 200);
    }
}
