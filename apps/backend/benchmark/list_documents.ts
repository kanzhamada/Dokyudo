/**
 * Lists documents (and optionally chunk previews) for a tenant.
 * Helper for building the benchmark eval set.
 *
 * Usage (from apps/backend):
 *   BENCHMARK_TENANT_ID=<TENANT_ID> deno task benchmark:list
 *   BENCHMARK_TENANT_ID=<TENANT_ID> deno task benchmark:list -- <DOCUMENT_ID>
 */
import { and, desc, eq } from "drizzle-orm";
import { withAuthDb } from "../src/config/drizzle.ts";
import {
    documentChunks,
    documents,
} from "../src/shared/models/db.model.ts";

const args = Deno.args.filter((a) => a !== "--");
const tenantId = Deno.env.get("BENCHMARK_TENANT_ID") ?? "";
if (!tenantId) {
    console.error(
        "Missing tenant id: BENCHMARK_TENANT_ID=<TENANT_ID> deno task benchmark:list",
    );
    Deno.exit(2);
}

const docId = args[0];

if (docId) {
    const chunks = await withAuthDb(tenantId, async (tx) => {
        return await tx
            .select({
                id: documentChunks.id,
                chunkIndex: documentChunks.chunkIndex,
                metadata: documentChunks.metadata,
                content: documentChunks.content,
            })
            .from(documentChunks)
            .where(
                and(
                    eq(documentChunks.documentId, docId),
                    eq(documentChunks.tenantId, tenantId),
                ),
            )
            .orderBy(documentChunks.chunkIndex);
    });

    for (const c of chunks) {
        const pages = (c.metadata as { pages?: number[] } | null)?.pages ?? [];
        console.log(`--- chunk ${c.chunkIndex} (${c.id}) pages=[${pages.join(",")}] ---`);
        console.log(c.content.slice(0, 400));
        console.log();
    }
    console.log(`chunks: ${chunks.length}`);
    Deno.exit(0);
}

const rows = await withAuthDb(tenantId, async (tx) => {
    return await tx
        .select({
            id: documents.id,
            title: documents.title,
            status: documents.status,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
        })
        .from(documents)
        .orderBy(desc(documents.updatedAt));
});

for (const r of rows) {
    console.log(
        `${r.id}\t[${r.status}]\t${r.title}\t${r.updatedAt?.toISOString() ?? ""}`,
    );
}
console.log(`total: ${rows.length}`);
