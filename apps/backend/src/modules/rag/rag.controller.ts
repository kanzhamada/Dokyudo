import { Context } from "hono";
import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { RagService } from "./rag.service.ts";
import * as RagSchema from "./rag.schema.ts";

export async function handleChat(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId, logContext } = extractor.extractAuthContext();

    const body = extractor.extractValidJson<RagSchema.ChatBody>();

    const params: RagSchema.ChatServiceParams = {
        tenantId,
        userId,
        question: body.question,
        conversationId: body.conversation_id,
        logContext,
    };

    const stream = await RagService.streamChat(params);

    // Apply strict SSE headers as per sse-streaming-policy.md
    return c.body(stream, 200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    });
}

export async function handleUpdateConversationTitle(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId } = c.req.valid("param" as never) as { id: string };
    const body = extractor.extractValidJson<RagSchema.UpdateConversationBody>();

    await RagService.updateConversationTitle({
        userId,
        tenantId,
        conversationId,
        title: body.title,
    });

    return c.json({ data: { success: true } });
}

export async function handleDeleteConversation(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId } = c.req.valid("param" as never) as { id: string };

    await RagService.deleteConversation({
        userId,
        tenantId,
        conversationId,
    });

    return c.json({ data: { success: true } });
}
