import { and, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";
import { db, withAnonDb, withAuthDb } from "../../config/drizzle.ts";
import {
    chatShares,
    conversations,
    conversationTurns,
    tenants,
    users,
} from "../../shared/models/db.model.ts";
import { generateShareCode } from "../../shared/utils/base62.util.ts";
import { redis } from "../../config/redis.ts";
import { RedisKeys } from "../../shared/constants/redis_keys.constant.ts";

// Public-facing columns anon viewers may SELECT (granted at the DB level).
const PUBLIC_SHARE_COLUMNS = {
    code: chatShares.code,
    title: chatShares.title,
    snapshot: chatShares.snapshot,
    expiresAt: chatShares.expiresAt,
    conversationId: chatShares.conversationId,
    boundaryTurnId: chatShares.boundaryTurnId,
    createdAt: chatShares.createdAt,
} as const;

// Max Redis TTL regardless of the share's expiry option — even "no expiry"
// links are cached at most 1 month and renewed on every successful read.
const MAX_SHARE_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 1 month
// Floor so a sub-minute TTL never collapses the cache key prematurely; the
// DB expiry check remains authoritative.
const MIN_SHARE_CACHE_TTL_SECONDS = 60;

const CUSTOM_CODE_REGEX = /^[a-zA-Z0-9_-]{4,32}$/;
const AUTO_CODE_MAX_ATTEMPTS = 3;

const PG_UNIQUE_VIOLATION = "23505";

// Drizzle wraps Postgres errors in DrizzleQueryError — the SQLSTATE code lives
// on the inner `cause` (postgres-js PostgresError), not on the wrapper itself.
function isUniqueViolation(err: any): boolean {
    return (
        err?.code === PG_UNIQUE_VIOLATION ||
        err?.cause?.code === PG_UNIQUE_VIOLATION
    );
}

async function lookupShareAuthorName(code: string): Promise<string | null> {
    try {
        const [author] = await db
            .select({ authorName: tenants.name })
            .from(chatShares)
            .leftJoin(users, eq(users.id, chatShares.createdBy))
            .leftJoin(tenants, eq(tenants.id, users.tenantId))
            .where(eq(chatShares.code, code))
            .limit(1);
        return author?.authorName ?? null;
    } catch (err: any) {
        // Author metadata is useful for previews, but must not break a valid share.
        console.error("[Share] Author metadata lookup failed:", err.message);
        return null;
    }
}

interface SnapshotTurn {
    question: string;
    answer: string;
    modelUsed: string | null;
    status: string;
    contextReferences: unknown;
    createdAt: string;
}

/** Remaining seconds until the share expires — or the 1-month cap for no-expiry shares. */
export function shareCacheTtlSeconds(expiresAt: Date | null): number {
    if (!expiresAt) return MAX_SHARE_CACHE_TTL_SECONDS;
    const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    return Math.max(MIN_SHARE_CACHE_TTL_SECONDS, Math.min(remaining, MAX_SHARE_CACHE_TTL_SECONDS));
}

export class ShareService {
    /**
     * Creates a public share of a conversation. The turns are snapshotted at
     * this moment (immutable) — later edits/new turns never reach the public
     * view. Returns the short code; the frontend composes the full URL.
     */
    static async createShare(params: {
        userId: string;
        tenantId: string;
        conversationId: string;
        expiresInHours?: number;
        customCode?: string;
    }): Promise<{ code: string }> {
        const { userId, tenantId, conversationId, expiresInHours, customCode } = params;

        const custom = customCode?.trim();
        if (custom && !CUSTOM_CODE_REGEX.test(custom)) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message:
                    "Custom code must be 4-32 characters: letters, numbers, '-' or '_'",
                status: 400,
            });
        }

        let conversationTitle = "";
        let snapshot: SnapshotTurn[] = [];
        let boundaryTurnId: string | null = null;
        let insertedCode: string | null = null;

        await withAuthDb(userId, async (tx) => {
            const [conv] = await tx
                .select({ id: conversations.id, title: conversations.title })
                .from(conversations)
                .where(
                    and(
                        eq(conversations.id, conversationId),
                        eq(conversations.tenantId, tenantId),
                    ),
                );
            if (!conv) {
                throw new AppError({
                    code: "NOT_FOUND",
                    message: "Conversation not found",
                    status: 404,
                });
            }
            conversationTitle = conv.title;

            // Snapshot every turn except in-flight ones ("processing" rows can
            // only appear when a stream is mid-write — the UI disables sharing
            // while generating, this is the backend guard).
            const turns = await tx
                .select({
                    question: conversationTurns.question,
                    answer: conversationTurns.answer,
                    modelUsed: conversationTurns.modelUsed,
                    status: conversationTurns.status,
                    contextReferences: conversationTurns.contextReferences,
                    createdAt: conversationTurns.createdAt,
                    id: conversationTurns.id,
                })
                .from(conversationTurns)
                .where(
                    and(
                        eq(conversationTurns.conversationId, conversationId),
                        eq(conversationTurns.tenantId, tenantId),
                        ne(conversationTurns.status, "processing"),
                    ),
                )
                .orderBy(conversationTurns.createdAt);

            if (turns.length === 0) {
                throw new AppError({
                    code: "VALIDATION_ERROR",
                    message: "Nothing to share — the conversation has no turns",
                    status: 400,
                });
            }

            snapshot = turns.map((t) => ({
                question: t.question,
                answer: t.answer,
                modelUsed: t.modelUsed,
                status: t.status,
                contextReferences: t.contextReferences,
                createdAt: t.createdAt.toISOString(),
            }));
            boundaryTurnId = turns[turns.length - 1].id;

            const expiresAt = expiresInHours
                ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
                : null;

            if (custom) {
                try {
                    await tx.insert(chatShares).values({
                        code: custom,
                        tenantId,
                        createdBy: userId,
                        conversationId,
                        boundaryTurnId,
                        title: conversationTitle,
                        snapshot,
                        isCustom: true,
                        expiresAt,
                    });
                    insertedCode = custom;
                } catch (err: any) {
                    if (isUniqueViolation(err)) {
                        throw new AppError({
                            code: "CODE_TAKEN",
                            message: "That custom code is already taken",
                            status: 409,
                        });
                    }
                    throw err;
                }
            } else {
                for (let attempt = 0; attempt < AUTO_CODE_MAX_ATTEMPTS && !insertedCode; attempt++) {
                    const code = generateShareCode();
                    try {
                        await tx.insert(chatShares).values({
                            code,
                            tenantId,
                            createdBy: userId,
                            conversationId,
                            boundaryTurnId,
                            title: conversationTitle,
                            snapshot,
                            isCustom: false,
                            expiresAt,
                        });
                        insertedCode = code;
                    } catch (err: any) {
                        if (!isUniqueViolation(err)) throw err;
                        // collision — try a fresh code
                    }
                }
                if (!insertedCode) {
                    throw new AppError({
                        code: "INTERNAL_ERROR",
                        message: "Failed to allocate a unique share code, please retry",
                        status: 500,
                    });
                }
            }
        });

        return { code: insertedCode! };
    }

    /**
     * Public (unauthenticated) read of a share. Served from Redis when warm;
     * the DB is the source of truth and the TTL follows the share's expiry.
     */
    static async getPublicShare(params: { code: string }): Promise<{
        code: string;
        title: string;
        authorName: string | null;
        expiresAt: string | null;
        createdAt: string;
        conversationId: string;
        boundaryTurnId: string | null;
        turns: SnapshotTurn[];
    }> {
        const { code } = params;
        const cacheKey = RedisKeys.shareCache(code);

        // 1. Cache hit — renew the sliding TTL and serve.
        try {
            const cached = await redis.get<string>(cacheKey);
            if (cached) {
                const payload = JSON.parse(cached);
                const expiresAt = payload.expiresAt
                    ? new Date(payload.expiresAt)
                    : null;
                await redis.expire(
                    cacheKey,
                    shareCacheTtlSeconds(expiresAt),
                );
                if (!Object.hasOwn(payload, "authorName")) {
                    payload.authorName = await lookupShareAuthorName(code);
                    await redis.set(cacheKey, JSON.stringify(payload), {
                        ex: shareCacheTtlSeconds(expiresAt),
                    });
                }
                return { ...payload, authorName: payload.authorName ?? null };
            }
        } catch (err: any) {
            // Cache failures must never break the public read — fall through.
            console.error("[Share] Cache read error:", err.message);
        }

        // 2. Cache miss — read as the anon role (column-level grant limits the
        //    visible columns; RLS hides expired rows).
        let row: {
            code: string;
            title: string;
            snapshot: unknown;
            expiresAt: Date | null;
            conversationId: string;
            boundaryTurnId: string | null;
            createdAt: Date;
        } | null = null;

        await withAnonDb(async (tx) => {
            const rows = await tx
                .select(PUBLIC_SHARE_COLUMNS)
                .from(chatShares)
                .where(
                    and(
                        eq(chatShares.code, code),
                        or(
                            isNull(chatShares.expiresAt),
                            gt(chatShares.expiresAt, new Date()),
                        ),
                    ),
                )
                .limit(1);
            row = rows[0] ?? null;
        });

        if (!row) {
            // Lazy-delete: an expired (or already removed) share stays gone.
            try {
                await db
                    .delete(chatShares)
                    .where(eq(chatShares.code, code));
            } catch {
                // non-fatal
            }
            throw new AppError({
                code: "NOT_FOUND",
                message: "Share link not found or expired",
                status: 404,
            });
        }

        const payload = {
            code: row.code,
            title: row.title,
            authorName: await lookupShareAuthorName(code),
            expiresAt: row.expiresAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            conversationId: row.conversationId,
            boundaryTurnId: row.boundaryTurnId,
            turns: (row.snapshot ?? []) as SnapshotTurn[],
        };

        try {
            await redis.set(cacheKey, JSON.stringify(payload), {
                ex: shareCacheTtlSeconds(row.expiresAt),
            });
        } catch (err: any) {
            console.error("[Share] Cache write error:", err.message);
        }

        return payload;
    }

    /**
     * Authenticated "continue this chat" from a public share. Builds a NEW
     * conversation from the share's snapshot (not from the original
     * conversation) — this stays correct even for future subset shares.
     */
    static async continueShare(params: {
        userId: string;
        tenantId: string;
        code: string;
    }): Promise<{ id: string; title: string }> {
        const { userId, tenantId, code } = params;

        // Read the share via the superuser connection: the snapshot is public
        // by design, and the viewer's own tenant must not gate the read.
        const [share] = await db
            .select({
                title: chatShares.title,
                snapshot: chatShares.snapshot,
                conversationId: chatShares.conversationId,
                boundaryTurnId: chatShares.boundaryTurnId,
                expiresAt: chatShares.expiresAt,
            })
            .from(chatShares)
            .where(
                and(
                    eq(chatShares.code, code),
                    or(
                        isNull(chatShares.expiresAt),
                        gt(chatShares.expiresAt, new Date()),
                    ),
                ),
            )
            .limit(1);

        if (!share) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Share link not found or expired",
                status: 404,
            });
        }

        const snapshot = (share.snapshot ?? []) as SnapshotTurn[];

        let newConversationId = "";
        let newConversationTitle = "";

        await withAuthDb(userId, async (tx) => {
            const [newConv] = await tx
                .insert(conversations)
                .values({
                    tenantId,
                    // Plain copy of the shared title — no "Branched -" prefix
                    // and no branchOf lineage: a continued chat stands on its
                    // own and never shows a "Branched from" marker.
                    title: share.title,
                })
                .returning({ id: conversations.id, title: conversations.title });
            newConversationId = newConv.id;
            newConversationTitle = newConv.title;

            if (snapshot.length > 0) {
                await tx.insert(conversationTurns).values(
                    snapshot.map((t) => ({
                        id: crypto.randomUUID(),
                        tenantId,
                        conversationId: newConversationId,
                        question: t.question,
                        answer: t.answer,
                        modelUsed: t.modelUsed,
                        contextReferences: t.contextReferences as any,
                        status: t.status as any,
                        branchedFromTurnId: null,
                        createdAt: new Date(t.createdAt),
                    })),
                );
            }
        });

        return { id: newConversationId, title: newConversationTitle };
    }

    /** Deletes a single share owned by the tenant (revoke). */
    static async deleteShare(params: {
        userId: string;
        tenantId: string;
        code: string;
    }): Promise<void> {
        const { userId, tenantId, code } = params;

        await withAuthDb(userId, async (tx) => {
            const result = await tx
                .delete(chatShares)
                .where(
                    and(
                        eq(chatShares.code, code),
                        eq(chatShares.tenantId, tenantId),
                    ),
                )
                .returning({ code: chatShares.code });

            if (result.length === 0) {
                throw new AppError({
                    code: "NOT_FOUND",
                    message: "Share not found",
                    status: 404,
                });
            }
        });

        try {
            await redis.del(RedisKeys.shareCache(code));
        } catch {
            // non-fatal
        }
    }

    /** Deletes every share of a conversation ("stop sharing" from the sidebar). */
    static async deleteAllShares(params: {
        userId: string;
        tenantId: string;
        conversationId: string;
    }): Promise<{ deleted: number }> {
        const { userId, tenantId, conversationId } = params;

        let codes: string[] = [];
        await withAuthDb(userId, async (tx) => {
            const rows = await tx
                .select({ code: chatShares.code })
                .from(chatShares)
                .where(
                    and(
                        eq(chatShares.conversationId, conversationId),
                        eq(chatShares.tenantId, tenantId),
                    ),
                );
            codes = rows.map((r) => r.code);
            await tx
                .delete(chatShares)
                .where(
                    and(
                        eq(chatShares.conversationId, conversationId),
                        eq(chatShares.tenantId, tenantId),
                    ),
                );
        });

        if (codes.length > 0) {
            try {
                await redis.del(...codes.map((code) => RedisKeys.shareCache(code)));
            } catch {
                // non-fatal
            }
        }

        return { deleted: codes.length };
    }

    /** Lists the active shares of a conversation (manage dialog). */
    static async listShares(params: {
        userId: string;
        tenantId: string;
        conversationId: string;
    }): Promise<
        Array<{
            code: string;
            title: string;
            isCustom: boolean;
            expiresAt: string | null;
            createdAt: string;
        }>
    > {
        const { userId, tenantId, conversationId } = params;

        let rows: any[] = [];
        await withAuthDb(userId, async (tx) => {
            rows = await tx
                .select({
                    code: chatShares.code,
                    title: chatShares.title,
                    isCustom: chatShares.isCustom,
                    expiresAt: chatShares.expiresAt,
                    createdAt: chatShares.createdAt,
                })
                .from(chatShares)
                .where(
                    and(
                        eq(chatShares.conversationId, conversationId),
                        eq(chatShares.tenantId, tenantId),
                    ),
                )
                .orderBy(desc(chatShares.createdAt))
                .limit(50);
        });

        return rows.map((r) => ({
            code: r.code,
            title: r.title,
            isCustom: r.isCustom,
            expiresAt: r.expiresAt?.toISOString() ?? null,
            createdAt: r.createdAt.toISOString(),
        }));
    }

    /** Lists every active share owned by the tenant for account-level management. */
    static async listAllShares(params: {
        userId: string;
        tenantId: string;
    }): Promise<
        Array<{
            code: string;
            title: string;
            isCustom: boolean;
            expiresAt: string | null;
            createdAt: string;
        }>
    > {
        const { userId, tenantId } = params;

        let rows: any[] = [];
        await withAuthDb(userId, async (tx) => {
            rows = await tx
                .select({
                    code: chatShares.code,
                    title: chatShares.title,
                    isCustom: chatShares.isCustom,
                    expiresAt: chatShares.expiresAt,
                    createdAt: chatShares.createdAt,
                })
                .from(chatShares)
                .where(
                    and(
                        eq(chatShares.tenantId, tenantId),
                        or(
                            isNull(chatShares.expiresAt),
                            gt(chatShares.expiresAt, new Date()),
                        ),
                    ),
                )
                .orderBy(desc(chatShares.createdAt))
                .limit(100);
        });

        return rows.map((r) => ({
            code: r.code,
            title: r.title,
            isCustom: r.isCustom,
            expiresAt: r.expiresAt?.toISOString() ?? null,
            createdAt: r.createdAt.toISOString(),
        }));
    }
}
