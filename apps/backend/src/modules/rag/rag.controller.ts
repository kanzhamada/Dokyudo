import { Context } from "hono";
import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { RagService } from "./rag.service.ts";
import { ShareService } from "./share.service.ts";
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
        provider: body.provider,
        model: body.model,
        useByok: body.useByok,
        editTurnId: body.edit_turn_id,
        retryTurnId: body.retry_turn_id,
        selectedVariantId: body.selected_variant_id,
        signal: c.req.raw.signal,
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

export async function handleUpdateConversation(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId } = c.req.valid("param" as never) as { id: string };
    const body = extractor.extractValidJson<RagSchema.UpdateConversationBody>();

    await RagService.updateConversation({
        userId,
        tenantId,
        conversationId,
        title: body.title,
        isPinned: body.isPinned,
    });

    return c.json({ data: { success: true } });
}

export async function handleUpdateTurnFeedback(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId, turnId } = c.req.valid("param" as never) as {
        id: string;
        turnId: string;
    };
    const body = extractor.extractValidJson<RagSchema.TurnFeedbackBody>();

    await RagService.updateTurnFeedback({
        userId,
        tenantId,
        conversationId,
        turnId,
        rating: body.rating,
    });

    return c.json({ data: { success: true } });
}

export async function handleDeleteTurn(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId, turnId } = c.req.valid("param" as never) as {
        id: string;
        turnId: string;
    };

    await RagService.deleteTurn({
        userId,
        tenantId,
        conversationId,
        turnId,
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

export async function handleListConversations(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const query = c.req.valid("query" as never) as { limit: number; cursor?: string };

    const result = await RagService.listConversations({
        userId,
        tenantId,
        limit: query.limit,
        cursor: query.cursor,
    });

    return c.json(result);
}

export async function handleGetConversation(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId } = c.req.valid("param" as never) as { id: string };

    const result = await RagService.getConversation({
        userId,
        tenantId,
        conversationId,
    });

    return c.json(result);
}

export async function handleBranchConversation(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId } = c.req.valid("param" as never) as { id: string };
    const body = extractor.extractValidJson<RagSchema.BranchConversationBody>();

    const result = await RagService.branchConversation({
        userId,
        tenantId,
        conversationId,
        turnId: body.turn_id,
    });

    return c.json({ id: result.id, title: result.title });
}

// ==============================================================================
// Public Share
// ==============================================================================

export async function handleCreateShare(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId } = c.req.valid("param" as never) as { id: string };
    const body = extractor.extractValidJson<RagSchema.CreateShareBody>();

    const result = await ShareService.createShare({
        userId,
        tenantId,
        conversationId,
        expiresInHours: body.expires_in_hours,
        customCode: body.custom_code,
        emails: body.emails,
        notify: body.notify ?? false,
    });

    return c.json({ code: result.code, accessToken: result.accessToken });
}

/** Public, unauthenticated read of a share link (private shares need `?invite=`). */
export async function handleGetPublicShare(c: Context) {
    const { code } = c.req.valid("param" as never) as { code: string };
    const { invite } = (c.req.valid("query" as never) as { invite?: string }) ?? {};

    const result = await ShareService.getPublicShare({ code, inviteToken: invite });

    return c.json(result);
}

/** Adds email invitees to an existing share and optionally notifies them. */
export async function handleAddShareInvitees(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { code } = c.req.valid("param" as never) as { code: string };
    const body = extractor.extractValidJson<RagSchema.AddShareInviteesBody>();

    const result = await ShareService.addShareInvitees({
        userId,
        tenantId,
        code,
        emails: body.emails,
        notify: body.notify ?? false,
    });

    return c.json({ added: result.added, accessToken: result.accessToken });
}

export async function handleContinueShare(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { code } = c.req.valid("param" as never) as { code: string };

    const result = await ShareService.continueShare({ userId, tenantId, code });

    return c.json({ id: result.id, title: result.title });
}

export async function handleDeleteShare(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { code } = c.req.valid("param" as never) as { code: string };

    await ShareService.deleteShare({ userId, tenantId, code });

    return c.json({ data: { success: true } });
}

export async function handleDeleteAllShares(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const { id: conversationId } = c.req.valid("param" as never) as { id: string };

    const result = await ShareService.deleteAllShares({
        userId,
        tenantId,
        conversationId,
    });

    return c.json({ data: { success: true, deleted: result.deleted } });
}

export async function handleListAllShares(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const result = await ShareService.listAllShares({ userId, tenantId });
    return c.json({ shares: result });
}

export async function handleDeleteTenantShares(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, userId } = extractor.extractAuthContext();

    const result = await ShareService.deleteAllTenantShares({ userId, tenantId });

    return c.json({ data: { success: true, deleted: result.deleted } });
}
