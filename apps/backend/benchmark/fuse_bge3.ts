/**
 * BGE-M3 + FTS fusion analysis — the decision-relevant comparison.
 *
 * The raw BGE-M3 A/B measured vector-only, which cannot beat the production
 * hybrid (it lacks FTS). This script fuses the BGE-M3 vector rankings (from the
 * `bench-bge-m3` namespace) with the TRUE FTS rankings (queried directly from
 * Postgres — NOT the fused lists stored in the sweep report, which contain
 * zero-score vector padding for the "FTS-only" config) using the production RRF
 * config (k=60, fts=2, vec=1), then measures doc-level recall@k / MRR@k and
 * compares per-case against the hybrid+qwen3 baseline.
 *
 * Usage: deno task benchmark:bge3-fuse -- --tenant <TENANT_ID>
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { withAuthDb } from "../src/config/drizzle.ts";
import { documentChunks } from "../src/shared/models/db.model.ts";
import { vectorIndex } from "../src/config/vector.ts";
import { fuseWithRRF, type RankedId } from "../src/modules/search/rrf.ts";
import { mean, mrrAtK, recallAtK, uniqueDocumentIds } from "./metrics.ts";

const BGE_MODEL = "@cf/baai/bge-m3";
const NAMESPACE = "bench-bge-m3";
const TOP_K = 20;
const EMBED_BATCH = 32;
const QUERY_KS = [1, 3, 5, 10];
const FUSION = { k: 60, ftsWeight: 2, vectorWeight: 1 };
const HYBRID_LABEL = "k=60,fts=2,vec=1";

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
    if (!res.ok) throw new Error(`BGE-M3 API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    if (!data.success) throw new Error(`BGE-M3 API failed: ${JSON.stringify(data.errors)}`);
    return data.result.data;
}

async function embedBatches(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
        out.push(...(await cloudflareEmbed(texts.slice(i, i + EMBED_BATCH))));
        await new Promise((r) => setTimeout(r, 150));
    }
    return out;
}

function firstGoldenRank(docIds: string[], golden: string[]): number | null {
    const g = new Set(golden);
    for (let i = 0; i < docIds.length; i++) if (g.has(docIds[i])) return i + 1;
    return null;
}

function loadLatestSweep(): any {
    const files = [...Deno.readDirSync("./benchmark/results")]
        .map((e) => e.name)
        .filter((n) => n.startsWith("sweep-") && n.endsWith(".json"))
        .sort();
    if (files.length === 0) throw new Error("no sweep report found — run the sweep first");
    return JSON.parse(Deno.readTextFileSync(`./benchmark/results/${files[files.length - 1]}`));
}

async function main(): Promise<void> {
    const args = Deno.args.filter((a) => a !== "--");
    const flagArg = (f: string) => {
        const i = args.indexOf(f);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const tenantId = flagArg("--tenant") ?? Deno.env.get("BENCHMARK_TENANT_ID") ?? "";
    if (!tenantId) {
        console.error("[fuse] Missing tenant: --tenant <TENANT_ID> or BENCHMARK_TENANT_ID");
        Deno.exit(2);
    }
    const evalPath = flagArg("--eval-set") ?? Deno.env.get("BENCHMARK_EVAL_SET") ?? "./benchmark/eval_set.json";

    const evalSet: { cases: EvalCase[] } = JSON.parse(Deno.readTextFileSync(evalPath));
    const cases = evalSet.cases;
    const sweep = loadLatestSweep();

    // chunk id -> document id map
    const chunkDocs = await withAuthDb(tenantId, async (tx) =>
        tx
            .select({ id: documentChunks.id, documentId: documentChunks.documentId })
            .from(documentChunks)
            .where(eq(documentChunks.tenantId, tenantId))
    );
    const docOf = new Map<string, string>();
    for (const c of chunkDocs) docOf.set(c.id, c.documentId);

    // TRUE FTS chunk rankings per case — queried directly from Postgres
    // (top-20 by ts_rank), NOT the fused lists from the sweep report (those
    // contain zero-score vector padding when FTS has fewer than limit matches).
    const ftsRankedByCase = new Map<string, RankedId[]>();
    for (const c of cases) {
        const tsquery = sql`(websearch_to_tsquery('indonesian', ${c.query}) || websearch_to_tsquery('english', ${c.query}))`;
        const rows = await withAuthDb(tenantId, async (tx) =>
            tx
                .select({ id: documentChunks.id })
                .from(documentChunks)
                .where(
                    and(
                        eq(documentChunks.tenantId, tenantId),
                        sql`${documentChunks.fts} @@ ${tsquery}`,
                    ),
                )
                .orderBy(desc(sql`ts_rank(${documentChunks.fts}, ${tsquery})`))
                .limit(TOP_K)
        );
        ftsRankedByCase.set(c.id, rows.map((r, i) => ({ id: r.id, rank: i + 1 })));
    }

    // embed queries
    console.log(`[fuse] embedding ${cases.length} queries with ${BGE_MODEL}...`);
    const queryVectors = await embedBatches(cases.map((c) => c.query));
    const ns = vectorIndex.namespace(NAMESPACE);

    const perCase: Array<{
        id: string;
        expectedDocumentIds: string[];
        docIds: string[];
        rank: number | null;
        hybridRank: number | null;
        fixed: boolean;
    }> = [];

    for (let i = 0; i < cases.length; i++) {
        const res = await ns.query({
            vector: queryVectors[i],
            topK: TOP_K,
            includeMetadata: true,
        });
        const bge3Ranked: RankedId[] = res.map((r, idx) => ({ id: r.id as string, rank: idx + 1 }));

        const merged = fuseWithRRF(bge3Ranked, ftsRankedByCase.get(cases[i].id) ?? [], FUSION)
            .slice(0, 10)
            .map((r) => r.id);

        const docIds = uniqueDocumentIds(
            merged.map((id) => ({ id, documentId: docOf.get(id) ?? "" })).filter((x) => x.documentId),
        );

        const hybrid = sweep.cases.find((c: any) => c.id === cases[i].id)?.byConfig?.[HYBRID_LABEL];
        const hybridRank = hybrid ? firstGoldenRank(hybrid.docIds, cases[i].expectedDocumentIds) : null;
        const rank = firstGoldenRank(docIds, cases[i].expectedDocumentIds);

        perCase.push({
            id: cases[i].id,
            expectedDocumentIds: cases[i].expectedDocumentIds,
            docIds,
            rank,
            hybridRank,
            fixed: rank !== null && hybridRank === null,
        });
    }

    // metrics
    const recallAtKMap: Record<number, number> = {};
    const mrrAtKMap: Record<number, number> = {};
    for (const k of QUERY_KS) {
        recallAtKMap[k] = mean(perCase.map((p, j) => recallAtK(cases[j].expectedDocumentIds, p.docIds, k)));
        mrrAtKMap[k] = mean(perCase.map((p, j) => mrrAtK(cases[j].expectedDocumentIds, p.docIds, k)));
    }

    const report = {
        createdAt: new Date().toISOString(),
        tenantId,
        fusion: FUSION,
        metrics: {
            recallAtK: Object.fromEntries(Object.entries(recallAtKMap).map(([k, v]) => [Number(k), Number((v as number).toFixed(4))])),
            mrrAtK: Object.fromEntries(Object.entries(mrrAtKMap).map(([k, v]) => [Number(k), Number((v as number).toFixed(4))])),
        },
        referenceHybridQwen3: sweep.metricsByConfig[HYBRID_LABEL],
        cases: perCase.map((p) => ({
            id: p.id,
            expectedDocumentIds: p.expectedDocumentIds,
            docIds: p.docIds,
            rank: p.rank,
            hybridRank: p.hybridRank,
            fixed: p.fixed,
        })),
    };

    Deno.mkdirSync("./benchmark/results", { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = `./benchmark/results/bge3-fusion-${stamp}.json`;
    Deno.writeTextFileSync(outPath, JSON.stringify(report, null, 2));

    const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;
    const h = sweep.metricsByConfig[HYBRID_LABEL];
    console.log("\n=== BGE-M3+FTS (fused) vs hybrid+qwen3 ===");
    console.log(`BGE3+FTS recall@k: ${Object.entries(report.metrics.recallAtK).map(([k, v]) => `k=${k} ${fmt(v as number)}`).join(" | ")}`);
    console.log(`BGE3+FTS mrr@k   : ${Object.entries(report.metrics.mrrAtK).map(([k, v]) => `k=${k} ${fmt(v as number)}`).join(" | ")}`);
    console.log(`hybrid+qwen3     : r@5 ${fmt(h.recallAtK[5])} mrr@1 ${fmt(h.mrrAtK[1])}`);
    console.log("\nper-case (rank fused vs rank hybrid):");
    for (const p of perCase) {
        const mark = p.fixed ? " ★fixed" : p.rank !== null && (p.hybridRank === null || p.rank < p.hybridRank) ? " ↑" :
            p.rank === null && p.hybridRank !== null ? " ✗regressed" :
            p.rank !== null && p.hybridRank !== null && p.rank > p.hybridRank ? " ↓" : "";
        console.log(`  ${p.id.padEnd(14)} fused=${p.rank ?? "-"}  hybrid=${p.hybridRank ?? "-"}${mark}`);
    }
    const fixedCount = perCase.filter((p) => p.fixed).length;
    const regressedCount = perCase.filter((p) => p.rank === null && p.hybridRank !== null).length;
    console.log(`\nfixed (hybrid miss -> fused hit): ${fixedCount}`);
    console.log(`regressed (hybrid hit -> fused miss): ${regressedCount}`);
    console.log(`Saved report: ${outPath}`);
}

await main();
