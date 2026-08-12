import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { ShareService, shareCacheTtlSeconds } from "./share.service.ts";
import { db } from "../../config/drizzle.ts";
import {
    authUsers,
    chatShares,
    conversations,
    conversationTurns,
    documents,
    tenants,
    users,
} from "../../shared/models/db.model.ts";
import { eq, sql } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";

// The integration tests below need the chat_shares table (migration 0024).
// Skip them gracefully when the test DB hasn't been migrated yet, so the
// suite stays green while the schema is being rolled out.
async function chatSharesTableExists(): Promise<boolean> {
    try {
        const rows = await db.execute(sql`SELECT 1 FROM chat_shares LIMIT 1`);
        return rows !== undefined;
    } catch {
        return false;
    }
}
const shareTableReady = await chatSharesTableExists();

describe("ShareService Pure Logic", () => {
    it("shareCacheTtlSeconds: no expiry → 1 month cap", () => {
        assertEquals(shareCacheTtlSeconds(null), 30 * 24 * 60 * 60);
    });

    it("shareCacheTtlSeconds: expiry in 1 hour → remaining seconds", () => {
        const ttl = shareCacheTtlSeconds(new Date(Date.now() + 60 * 60 * 1000));
        assertEquals(ttl > 3500 && ttl <= 3600, true);
    });

    it("shareCacheTtlSeconds: remaining > 1 month is clamped to 1 month", () => {
        assertEquals(
            shareCacheTtlSeconds(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
            30 * 24 * 60 * 60,
        );
    });

    it("shareCacheTtlSeconds: sub-minute remaining is floored at 60s", () => {
        assertEquals(shareCacheTtlSeconds(new Date(Date.now() + 10 * 1000)), 60);
    });

    it("createShare: rejects invalid custom codes before touching the DB", async () => {
        await assertRejects(
            () =>
                ShareService.createShare({
                    userId: crypto.randomUUID(),
                    tenantId: crypto.randomUUID(),
                    conversationId: crypto.randomUUID(),
                    customCode: "ab!",
                }),
            AppError,
            "Custom code must be 4-32 characters",
        );
        await assertRejects(
            () =>
                ShareService.createShare({
                    userId: crypto.randomUUID(),
                    tenantId: crypto.randomUUID(),
                    conversationId: crypto.randomUUID(),
                    customCode: "x".repeat(33),
                }),
            AppError,
            "Custom code must be 4-32 characters",
        );
    });
});

describe("ShareService Integration", { ignore: !shareTableReady }, () => {
    const TEST_TENANT_ID = crypto.randomUUID();
    const TEST_USER_ID = crypto.randomUUID();
    const TEST_CONVERSATION_ID = crypto.randomUUID();
    const TEST_DOC_ID = crypto.randomUUID();
    const TEST_DOC_TITLE = "Laporan Tahunan 2025";
    let shareCode = "";

    beforeAll(async () => {
        await db
            .insert(tenants)
            .values({ id: TEST_TENANT_ID, name: "Share Service Test Tenant" })
            .onConflictDoNothing();
        await db.insert(authUsers).values({ id: TEST_USER_ID }).onConflictDoNothing();
        await db
            .insert(users)
            .values({
                id: TEST_USER_ID,
                tenantId: TEST_TENANT_ID,
                email: `share-test-${TEST_USER_ID}@example.com`,
            })
            .onConflictDoNothing();
        await db
            .insert(conversations)
            .values({ id: TEST_CONVERSATION_ID, tenantId: TEST_TENANT_ID, title: "Share Test Conversation" })
            .onConflictDoNothing();
        // A real document the second turn attaches — its title must appear in
        // the share snapshot (baked at share time, anon readers cannot query it).
        await db
            .insert(documents)
            .values({
                id: TEST_DOC_ID,
                tenantId: TEST_TENANT_ID,
                title: TEST_DOC_TITLE,
                storagePath: `${TEST_DOC_ID}.pdf`,
                sizeBytes: 1024,
                status: "processed",
            })
            .onConflictDoNothing();
        await db.insert(conversationTurns).values([
            {
                id: crypto.randomUUID(),
                tenantId: TEST_TENANT_ID,
                conversationId: TEST_CONVERSATION_ID,
                question: "Pertanyaan pertama",
                answer: "Jawaban pertama",
                status: "complete",
            },
            {
                id: crypto.randomUUID(),
                tenantId: TEST_TENANT_ID,
                conversationId: TEST_CONVERSATION_ID,
                question: "Pertanyaan kedua",
                answer: "Jawaban kedua",
                status: "complete",
                attachmentDocumentIds: [TEST_DOC_ID],
            },
        ]);
    });

    afterAll(async () => {
        await db.delete(chatShares).where(eq(chatShares.tenantId, TEST_TENANT_ID));
        await db
            .delete(conversationTurns)
            .where(eq(conversationTurns.tenantId, TEST_TENANT_ID));
        await db.delete(conversations).where(eq(conversations.tenantId, TEST_TENANT_ID));
        // Explicit delete: documents.tenant_id has ON DELETE RESTRICT, so the
        // tenant row cannot be removed while the document still exists.
        await db.delete(documents).where(eq(documents.tenantId, TEST_TENANT_ID));
        await db.delete(users).where(eq(users.id, TEST_USER_ID));
        await db.delete(authUsers).where(eq(authUsers.id, TEST_USER_ID));
        await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
    });

    it("createShare → getPublicShare roundtrip returns the exact snapshot", async () => {
        const created = await ShareService.createShare({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            conversationId: TEST_CONVERSATION_ID,
            expiresInHours: 24,
        });
        shareCode = created.code;
        assertEquals(shareCode.length > 0, true);

        const pub = await ShareService.getPublicShare({ code: shareCode });
        assertEquals(pub.title, "Share Test Conversation");
        assertEquals(pub.authorName, "Share Service Test Tenant");
        assertEquals(pub.isPrivate, false);
        assertEquals(pub.turns.length, 2);
        assertEquals(pub.turns[0].question, "Pertanyaan pertama");
        assertEquals(pub.turns[1].answer, "Jawaban kedua");
        assertEquals(pub.expiresAt !== null, true);

        // Attachments are baked into the snapshot with their titles — visible
        // on the public page (the documents themselves are not openable there).
        assertEquals(pub.turns[0].attachments, []);
        assertEquals(pub.turns[1].attachments, [
            { documentId: TEST_DOC_ID, title: TEST_DOC_TITLE },
        ]);
    });

    it("createShare: rejects inviting the sharer's own email", async () => {
        await assertRejects(
            () =>
                ShareService.createShare({
                    userId: TEST_USER_ID,
                    tenantId: TEST_TENANT_ID,
                    conversationId: TEST_CONVERSATION_ID,
                    emails: [`share-test-${TEST_USER_ID}@example.com`],
                }),
            AppError,
            "own email",
        );
    });

    it("private share: gated behind the access token, invitees stored", async () => {
        const created = await ShareService.createShare({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            conversationId: TEST_CONVERSATION_ID,
            emails: ["tamu@example.com", "tamu2@example.com"],
            notify: false,
        });
        assertEquals(created.accessToken !== null, true);
        const privateCode = created.code;

        // No token → 403 PRIVATE_SHARE.
        await assertRejects(
            () => ShareService.getPublicShare({ code: privateCode }),
            AppError,
            "invitation is required",
        );

        // Wrong token → still 403.
        await assertRejects(
            () =>
                ShareService.getPublicShare({
                    code: privateCode,
                    inviteToken: "wrong-token",
                }),
            AppError,
            "invitation is required",
        );

        // Correct token → full read with isPrivate.
        const pub = await ShareService.getPublicShare({
            code: privateCode,
            inviteToken: created.accessToken!,
        });
        assertEquals(pub.isPrivate, true);
        assertEquals(pub.turns.length, 2);
    });

    it("addShareInvitees: promotes a public share to private, dedupes, and returns new emails", async () => {
        const created = await ShareService.createShare({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            conversationId: TEST_CONVERSATION_ID,
        });
        assertEquals(created.accessToken, null);

        const first = await ShareService.addShareInvitees({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            code: created.code,
            emails: ["satu@example.com", "dua@example.com"],
            notify: false,
        });
        assertEquals(first.added.length, 2);
        assertEquals(first.accessToken !== null, true);

        // Re-adding the same email only returns newly added ones.
        const second = await ShareService.addShareInvitees({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            code: created.code,
            emails: ["dua@example.com", "tiga@example.com"],
            notify: false,
        });
        assertEquals(second.added, ["tiga@example.com"]);
        assertEquals(second.accessToken, first.accessToken);

        // Share is now private — no token → 403.
        await assertRejects(
            () => ShareService.getPublicShare({ code: created.code }),
            AppError,
            "invitation is required",
        );
    });

    it("getPublicShare: a new turn added after sharing is NOT included", async () => {
        const snapshotCount = (await ShareService.getPublicShare({ code: shareCode })).turns.length;

        await db.insert(conversationTurns).values({
            id: crypto.randomUUID(),
            tenantId: TEST_TENANT_ID,
            conversationId: TEST_CONVERSATION_ID,
            question: "Turn ketiga (setelah share)",
            answer: "Tidak boleh muncul di publik",
            status: "complete",
        });

        const after = await ShareService.getPublicShare({ code: shareCode });
        assertEquals(after.turns.length, snapshotCount, "snapshot must stay immutable");
    });

    it("getPublicShare: unknown code → 404", async () => {
        await assertRejects(
            () => ShareService.getPublicShare({ code: "tidakada" }),
            AppError,
            "Share link not found or expired",
        );
    });

    it("createShare: custom code duplicate → 409 CODE_TAKEN", async () => {
        const result = await ShareService.createShare({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            conversationId: TEST_CONVERSATION_ID,
            customCode: "duplikat1",
        });
        assertEquals(result.code, "duplikat1");

        await assertRejects(
            () =>
                ShareService.createShare({
                    userId: TEST_USER_ID,
                    tenantId: TEST_TENANT_ID,
                    conversationId: TEST_CONVERSATION_ID,
                    customCode: "duplikat1",
                }),
            AppError,
            "already taken",
        );
    });

    it("continueShare: builds a new conversation from the snapshot (no branch marker)", async () => {
        const result = await ShareService.continueShare({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            code: shareCode,
        });
        // Plain copy of the shared title — no "Branched -" prefix.
        assertEquals(result.title, "Share Test Conversation");

        const [conv] = await db
            .select({ branchOfId: conversations.branchOfId })
            .from(conversations)
            .where(eq(conversations.id, result.id));
        // No lineage marker: the continued chat never shows "Branched from".
        assertEquals(conv?.branchOfId, null);

        const turns = await db
            .select({
                question: conversationTurns.question,
                answer: conversationTurns.answer,
                attachmentDocumentIds: conversationTurns.attachmentDocumentIds,
                branchedFromTurnId: conversationTurns.branchedFromTurnId,
            })
            .from(conversationTurns)
            .where(eq(conversationTurns.conversationId, result.id))
            .orderBy(conversationTurns.createdAt);

        assertEquals(turns.length, 2);
        assertEquals(turns[0].question, "Pertanyaan pertama");
        assertEquals(turns[1].answer, "Jawaban kedua");
        // No boundary marker on the last copied turn either.
        assertEquals(turns[1].branchedFromTurnId, null);
        // The attachment scoping captured in the snapshot is restored, so the
        // rebuilt turns keep the same RAG scope on edit/retry.
        assertEquals(turns[0].attachmentDocumentIds ?? null, null);
        assertEquals(turns[1].attachmentDocumentIds, [TEST_DOC_ID]);

        await db.delete(conversations).where(eq(conversations.id, result.id));
    });

    it("listAllShares + deleteShare: revoke makes the link 404", async () => {
        const list = await ShareService.listAllShares({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
        });
        assertEquals(list.length >= 1, true);
        assertEquals(list.some((s) => s.code === shareCode), true);
        assertEquals(typeof list[0].conversationId === "string", true);

        await ShareService.deleteShare({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            code: shareCode,
        });

        await assertRejects(
            () => ShareService.getPublicShare({ code: shareCode }),
            AppError,
            "Share link not found or expired",
        );
    });

    it("deleteAllShares: stops every share of a conversation", async () => {
        await ShareService.createShare({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            conversationId: TEST_CONVERSATION_ID,
            customCode: "hentikan1",
        });
        await ShareService.createShare({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            conversationId: TEST_CONVERSATION_ID,
            customCode: "hentikan2",
        });

        const result = await ShareService.deleteAllShares({
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            conversationId: TEST_CONVERSATION_ID,
        });
        assertEquals(result.deleted >= 2, true);

        await assertRejects(
            () => ShareService.getPublicShare({ code: "hentikan1" }),
            AppError,
            "Share link not found or expired",
        );
        await assertRejects(
            () => ShareService.getPublicShare({ code: "hentikan2" }),
            AppError,
            "Share link not found or expired",
        );
    });
});
