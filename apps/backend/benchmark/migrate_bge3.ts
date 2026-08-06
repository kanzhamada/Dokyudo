/**
 * BGE-M3 migration — re-embeds existing chunks with @cf/baai/bge-m3 and
 * overwrites the vectors in the PRODUCTION Upstash namespace (same chunk ids,
 * same metadata shape as the STB worker: { tenantId, documentId, chunkIndex,
 * pages, content }). No DB changes, no index rebuild (1024 dims match).
 *
 * Usage (from apps/backend):
 *   deno task benchmark:migrate-bge3 -- --tenant <TENANT_ID>
 *   deno task benchmark:migrate-bge3 -- --tenant <TENANT_ID> --docs <docId1>,<docId2>
 *
 * Note: run AFTER the backend/stb-worker configs point at @cf/baai/bge-m3 so
 * query embeddings and chunk embeddings use the same model.
 */
import { and, eq, inArray } from "drizzle-orm";import { withAuthDb } from "../src/config/drizzle.ts";
import { documentChunks } from "../src/shared/models/db.model.ts";
import { vectorIndex } from "../src/config/vector.ts";

const BGE_MODEL = "@cf/baai/bge-m3";
const EMBED_BATCH = 32; // 32 × ~1050 tokens ≈ 34K < 60K context
const UPSERT_BATCH = 100;

async function cloudflareEmbed(texts: string[]): Promise<number[][]> {
    const url =
        `https://api.cloudflare.com/client/v4/accounts/${Deno.env.get("CLOUDFLARE_ACCOUNT_ID")}/ai/run/${BGE_MODEL}`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${Deno.env.get("CLOUDFLARE_AUTH_TOKEN")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: texts }),
    });
    if (!res.ok) throw new Error(`BGE-M3 API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    if (!data.success) throw new Error(`BGE-M3 API failed: ${JSON.stringify(data.errors)}`);
    return data.result.data;
}

async function main(): Promise<void> {
    const args = Deno.args.filter((a) => a !== "--");
    const flagArg = (f: string) => {
        const i = args.indexOf(f);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const tenantId = flagArg("--tenant") ?? Deno.env.get("BENCHMARK_TENANT_ID") ?? "";
    if (!tenantId) {
        console.error("[migrate] Missing tenant: --tenant <TENANT_ID> or BENCHMARK_TENANT_ID");
        Deno.exit(2);
    }
    const docsArg = flagArg("--docs");
    const docIds = docsArg ? docsArg.split(",").map((s) => s.trim()).filter(Boolean) : null;

    const chunks = await withAuthDb(tenantId, async (tx) => {
        const conditions = [eq(documentChunks.tenantId, tenantId)];
        if (docIds && docIds.length > 0) {
            conditions.push(inArray(documentChunks.documentId, docIds));
        }
        return await tx
            .select({
                id: documentChunks.id,
                documentId: documentChunks.documentId,
                chunkIndex: documentChunks.chunkIndex,
                metadata: documentChunks.metadata,
                content: documentChunks.content,
            })
            .from(documentChunks)
            .where(and(...conditions));
    });

    if (chunks.length === 0) {
        console.error("[migrate] no chunks found for the given scope.");
        Deno.exit(1);
    }

    const docCount = new Set(chunks.map((c) => c.documentId)).size;
    console.log(`[migrate] ${chunks.length} chunks from ${docCount} docs -> ${BGE_MODEL}`);

    const vectors = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH);
        vectors.push(...(await cloudflareEmbed(batch.map((c) => c.content))));
        await new Promise((r) => setTimeout(r, 150));
        if ((i / EMBED_BATCH + 1) % 10 === 0) {
            console.log(`[migrate] embedded ${i + batch.length}/${chunks.length}`);
        }
    }

    console.log(`[migrate] upserting ${chunks.length} vectors to production namespace...`);
    const index = vectorIndex; // default namespace — overwrites existing vectors in place
    for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
        const batch = chunks.slice(i, i + UPSERT_BATCH);
        await index.upsert(
            batch.map((c, j) => ({
                id: c.id,
                vector: vectors[i + j],
                metadata: {
                    tenantId,
                    documentId: c.documentId,
                    chunkIndex: c.chunkIndex,
                    pages: (c.metadata as { pages?: number[] } | null)?.pages ?? [],
                    content: c.content,
                },
            })),
        );
    }

    console.log("[migrate] done.");
    console.log("[migrate] verify with: deno task benchmark -- --tenant " + tenantId);
}

await main();
