/**
 * BGE-M3 A/B test — contained, namespaced, no production change.
 *
 * Re-embeds ALL tenant chunks with @cf/baai/bge-m3 into the Upstash Vector
 * namespace `bench-bge-m3`, embeds the eval queries with the same model, and
 * measures doc-level recall@k / MRR@k (vector-only). Results are compared
 * against the production pipeline baselines (hybrid fts=2 and qwen3 vector-only)
 * captured in the latest sweep report.
 *
 * Usage (from apps/backend):
 *   deno task benchmark:bge3 -- --tenant <TENANT_ID>
 *   (or set BENCHMARK_TENANT_ID)
 *
 * Cost: ~2045 chunk embeddings + 47 query embeddings via Cloudflare Workers AI
 * (≈ $0.007 at list pricing). Vectors live in namespace `bench-bge-m3` and can
 * be removed independently of production data.
 */
import { eq } from "drizzle-orm";
import { withAuthDb } from "../src/config/drizzle.ts";
import { documentChunks } from "../src/shared/models/db.model.ts";
import { vectorIndex } from "../src/config/vector.ts";
import {
    mean,
    mrrAtK,
    recallAtK,
    uniqueDocumentIds,
} from "./metrics.ts";

const BGE_MODEL = "@cf/baai/bge-m3";
const NAMESPACE = "bench-bge-m3";
const TOP_K = 20;
const EMBED_BATCH = 32; // chunks are up to 1000 tokens; 32×~1050 ≈ 33K < 60K context
const UPSERT_BATCH = 100;
const QUERY_KS = [1, 3, 5, 10];

interface EvalCase {
    id: string;
    query: string;
    expectedDocumentIds: string[];
}

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
    if (!res.ok) {
        throw new Error(`BGE-M3 API error (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    if (!data.success) {
        throw new Error(`BGE-M3 API failed: ${JSON.stringify(data.errors)}`);
    }
    return data.result.data;
}

async function embedBatches(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
        const batch = texts.slice(i, i + EMBED_BATCH);
        out.push(...(await cloudflareEmbed(batch)));
        // Gentle pacing to stay under Workers AI rate limits.
        await new Promise((r) => setTimeout(r, 150));
    }
    return out;
}

function loadEvalSet(path: string): EvalCase[] {
    const raw = Deno.readTextFileSync(path);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.cases)) throw new Error("eval set has no cases array");
    return parsed.cases;
}

function firstGoldenRank(docIds: string[], golden: string[]): number | null {
    const goldenSet = new Set(golden);
    for (let i = 0; i < docIds.length; i++) {
        if (goldenSet.has(docIds[i])) return i + 1;
    }
    return null;
}

function loadLatestSweep(): Record<string, any> | null {
    const dir = "./benchmark/results";
    try {
        const files = [...Deno.readDirSync(dir)]
            .map((e) => e.name)
            .filter((n) => n.startsWith("sweep-") && n.endsWith(".json"))
            .sort();
        if (files.length === 0) return null;
        return JSON.parse(Deno.readTextFileSync(`${dir}/${files[files.length - 1]}`));
    } catch {
        return null;
    }
}

async function main(): Promise<void> {
    const args = Deno.args.filter((a) => a !== "--");
    const flagArg = (flag: string): string | undefined => {
        const idx = args.indexOf(flag);
        return idx >= 0 ? args[idx + 1] : undefined;
    };
    const tenantId = flagArg("--tenant") ?? Deno.env.get("BENCHMARK_TENANT_ID") ?? "";
    if (!tenantId) {
        console.error("[bge3] Missing tenant: --tenant <TENANT_ID> or BENCHMARK_TENANT_ID");
        Deno.exit(2);
    }
    const evalPath =
        flagArg("--eval-set") ??
        Deno.env.get("BENCHMARK_EVAL_SET") ??
        "./benchmark/eval_set.json";

    const cases = loadEvalSet(evalPath);
    console.log(`[bge3] tenant=${tenantId} cases=${cases.length}`);

    // 1. Load chunks
    const chunks = await withAuthDb(tenantId, async (tx) =>
        tx
            .select({
                id: documentChunks.id,
                documentId: documentChunks.documentId,
                content: documentChunks.content,
            })
            .from(documentChunks)
            .where(eq(documentChunks.tenantId, tenantId))
    );
    console.log(`[bge3] loaded ${chunks.length} chunks`);

    // 2. Embed chunks (BGE-M3) and upsert into namespace
    console.log(`[bge3] embedding ${chunks.length} chunks with ${BGE_MODEL}...`);
    const chunkVectors = await embedBatches(chunks.map((c) => c.content));
    console.log(`[bge3] upserting into namespace "${NAMESPACE}"...`);
    const ns = vectorIndex.namespace(NAMESPACE);
    for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
        const batch = chunks.slice(i, i + UPSERT_BATCH);
        const vectors = chunkVectors.slice(i, i + UPSERT_BATCH);
        await ns.upsert(
            batch.map((c, j) => ({
                id: c.id,
                vector: vectors[j],
                metadata: { documentId: c.documentId, tenantId, content: c.content },
            })),
        );
    }

    // 3. Embed queries and run vector-only retrieval on the namespace
    console.log(`[bge3] embedding ${cases.length} queries...`);
    const queryVectors = await embedBatches(cases.map((c) => c.query));

    const perCase: Array<{
        id: string;
        query: string;
        expectedDocumentIds: string[];
        docIds: string[];
        rank: number | null;
        hybridRank: number | null;
    }> = [];

    for (let i = 0; i < cases.length; i++) {
        const res = await ns.query({
            vector: queryVectors[i],
            topK: TOP_K,
            includeMetadata: true,
        });
        const docIds = uniqueDocumentIds(
            res.map((r) => ({
                id: r.id as string,
                documentId: (r.metadata as any)?.documentId as string,
            })),
        );
        perCase.push({
            id: cases[i].id,
            query: cases[i].query,
            expectedDocumentIds: cases[i].expectedDocumentIds,
            docIds,
            rank: firstGoldenRank(docIds, cases[i].expectedDocumentIds),
            hybridRank: null,
        });
    }

    // 4. Pull per-case hybrid ranks from the latest sweep report for comparison
    const sweep = loadLatestSweep();
    const hybridLabel = "k=60,fts=2,vec=1";
    if (sweep) {
        const byId = new Map<string, any>();
        for (const c of sweep.cases) byId.set(c.id, c);
        for (const p of perCase) {
            const h = byId.get(p.id);
            if (h?.byConfig?.[hybridLabel]) {
                p.hybridRank = firstGoldenRank(
                    h.byConfig[hybridLabel].docIds,
                    p.expectedDocumentIds,
                );
            }
        }
    }

    // 5. Metrics
    const recallAtKMap: Record<number, number> = {};
    const mrrAtKMap: Record<number, number> = {};
    for (const k of QUERY_KS) {
        recallAtKMap[k] = mean(perCase.map((p, i) => recallAtK(cases[i].expectedDocumentIds, p.docIds, k)));
        mrrAtKMap[k] = mean(perCase.map((p, i) => mrrAtK(cases[i].expectedDocumentIds, p.docIds, k)));
    }

    const report = {
        createdAt: new Date().toISOString(),
        model: BGE_MODEL,
        namespace: NAMESPACE,
        tenantId,
        topK: TOP_K,
        evalSet: evalPath,
        cases: perCase,
        metrics: {
            recallAtK: Object.fromEntries(Object.entries(recallAtKMap).map(([k, v]) => [Number(k), Number((v as number).toFixed(4))])),
            mrrAtK: Object.fromEntries(Object.entries(mrrAtKMap).map(([k, v]) => [Number(k), Number((v as number).toFixed(4))])),
        },
        referenceBaselines: sweep
            ? { hybridFts2Vec1: sweep.metricsByConfig[hybridLabel], qwen3VectorOnly: sweep.metricsByConfig["k=60,fts=0,vec=1"] }
            : null,
    };

    Deno.mkdirSync("./benchmark/results", { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = `./benchmark/results/bge-m3-${stamp}.json`;
    Deno.writeTextFileSync(outPath, JSON.stringify(report, null, 2));

    // 6. Console summary
    const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;
    console.log("\n=== BGE-M3 (vector-only) vs baselines ===");
    console.log(`BGE-M3 recall@k : ${Object.entries(report.metrics.recallAtK).map(([k, v]) => `k=${k} ${fmt(v as number)}`).join(" | ")}`);
    console.log(`BGE-M3 mrr@k    : ${Object.entries(report.metrics.mrrAtK).map(([k, v]) => `k=${k} ${fmt(v as number)}`).join(" | ")}`);
    if (sweep) {
        const h = sweep.metricsByConfig[hybridLabel];
        const v = sweep.metricsByConfig["k=60,fts=0,vec=1"];
        console.log(`hybrid fts2/vec1 : r@5 ${fmt(h.recallAtK[5])} mrr@1 ${fmt(h.mrrAtK[1])}`);
        console.log(`qwen3 vec-only   : r@5 ${fmt(v.recallAtK[5])} mrr@1 ${fmt(v.mrrAtK[1])}`);
    }
    console.log("\nper-case delta (rank BGE-M3 vs rank hybrid, '-' = miss):");
    for (const p of perCase) {
        const mark = p.hybridRank !== null && p.rank !== null && p.rank < p.hybridRank ? " ↑better" :
            p.rank === null && p.hybridRank === null ? " =miss" :
            p.rank !== null && p.hybridRank === null ? " ★fixed" :
            p.rank === null ? " ✗worse" : "";
        console.log(`  ${p.id.padEnd(14)} bge3=${p.rank ?? "-"}  hybrid=${p.hybridRank ?? "-"}${mark}`);
    }
    console.log(`\nSaved report: ${outPath}`);
    console.log(`Namespace "${NAMESPACE}" kept for inspection; remove via Upstash dashboard or REST delete.`);
}

await main();
