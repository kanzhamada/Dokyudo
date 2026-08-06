/**
 * FTS rank-function test — offline, no production change.
 *
 * The set of FTS-matching chunks does not depend on the rank function, only the
 * ordering does. So we can test alternative Postgres FTS ranking functions
 * (`ts_rank` vs `ts_rank_cd`, with/without normalization) directly against the
 * golden eval set, without touching the search service or re-embedding anything.
 *
 * Usage: deno task benchmark:fts-rank -- --tenant <TENANT_ID>
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { withAuthDb } from "../src/config/drizzle.ts";
import { documentChunks } from "../src/shared/models/db.model.ts";
import { mean, mrrAtK, recallAtK, uniqueDocumentIds } from "./metrics.ts";

const QUERY_KS = [1, 3, 5, 10];
const TOP_N = 10;

interface EvalCase {
    id: string;
    query: string;
    expectedDocumentIds: string[];
}

function loadEvalSet(path: string): EvalCase[] {
    const parsed = JSON.parse(Deno.readTextFileSync(path));
    if (!Array.isArray(parsed.cases)) throw new Error("eval set has no cases array");
    return parsed.cases;
}

function rankExpr(name: string, q: ReturnType<typeof sql>): ReturnType<typeof sql> {
    switch (name) {
        case "ts_rank":
            return sql`ts_rank(${documentChunks.fts}, ${q})`;
        case "ts_rank_cd":
            return sql`ts_rank_cd(${documentChunks.fts}, ${q})`;
        case "ts_rank_n32":
            return sql`ts_rank(${documentChunks.fts}, ${q}, 32)`; // normalize: rank/(rank+1)
        case "ts_rank_cd_n32":
            return sql`ts_rank_cd(${documentChunks.fts}, ${q}, 32)`;
        case "ts_rank_n8":
            return sql`ts_rank(${documentChunks.fts}, ${q}, 8)`; // normalize: 1/(1+unique words)
        default:
            throw new Error(`unknown rank function: ${name}`);
    }
}

const FUNCS = ["ts_rank", "ts_rank_cd", "ts_rank_n32", "ts_rank_cd_n32", "ts_rank_n8"];

async function main(): Promise<void> {
    const args = Deno.args.filter((a) => a !== "--");
    const flagArg = (f: string) => {
        const i = args.indexOf(f);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const tenantId = flagArg("--tenant") ?? Deno.env.get("BENCHMARK_TENANT_ID") ?? "";
    if (!tenantId) {
        console.error("[fts-rank] Missing tenant: --tenant <TENANT_ID> or BENCHMARK_TENANT_ID");
        Deno.exit(2);
    }
    const evalPath = flagArg("--eval-set") ?? Deno.env.get("BENCHMARK_EVAL_SET") ?? "./benchmark/eval_set.json";
    const cases = loadEvalSet(evalPath);

    // chunk id -> document id map
    const chunkDocs = await withAuthDb(tenantId, async (tx) =>
        tx
            .select({ id: documentChunks.id, documentId: documentChunks.documentId })
            .from(documentChunks)
            .where(eq(documentChunks.tenantId, tenantId))
    );
    const docOf = new Map<string, string>();
    for (const c of chunkDocs) docOf.set(c.id, c.documentId);

    // per-case ranked chunk lists per rank function
    const rankedByCase: Record<string, Record<string, string[]>> = {};

    for (const c of cases) {
        rankedByCase[c.id] = {};
        const tsquery = sql`(websearch_to_tsquery('indonesian', ${c.query}) || websearch_to_tsquery('english', ${c.query}))`;

        for (const fn of FUNCS) {
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
                    .orderBy(desc(rankExpr(fn, tsquery)))
                    .limit(TOP_N)
            );
            rankedByCase[c.id][fn] = rows.map((r) => r.id);
        }
    }

    // metrics per function
    const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;
    console.log(`\n=== FTS rank-function test (${cases.length} cases, top-${TOP_N} chunks) ===`);
    console.log(`reference FTS-only baseline (sweep): r@1 66.1% mrr@1 80.6% | hybrid: mrr@1 80.8%`);
    console.log(`${"function".padEnd(18)} r@1      r@3      r@5      mrr@1    mrr@3    mrr@5`);
    const results: Record<string, { recallAtK: Record<number, number>; mrrAtK: Record<number, number> }> = {};

    for (const fn of FUNCS) {
        const recallAtKMap: Record<number, number> = {};
        const mrrAtKMap: Record<number, number> = {};
        for (const k of QUERY_KS) {
            recallAtKMap[k] = mean(cases.map((c, i) => {
                const docIds = uniqueDocumentIds(rankedByCase[c.id][fn].map((id) => ({ id, documentId: docOf.get(id) ?? "" })).filter((x) => x.documentId));
                return recallAtK(c.expectedDocumentIds, docIds, k);
            }));
            mrrAtKMap[k] = mean(cases.map((c, i) => {
                const docIds = uniqueDocumentIds(rankedByCase[c.id][fn].map((id) => ({ id, documentId: docOf.get(id) ?? "" })).filter((x) => x.documentId));
                return mrrAtK(c.expectedDocumentIds, docIds, k);
            }));
        }
        results[fn] = { recallAtK: recallAtKMap, mrrAtK: mrrAtKMap };
        console.log(
            `${fn.padEnd(18)} ${fmt(recallAtKMap[1])}    ${fmt(recallAtKMap[3])}    ${fmt(recallAtKMap[5])}    ${fmt(mrrAtKMap[1])}    ${fmt(mrrAtKMap[3])}    ${fmt(mrrAtKMap[5])}`,
        );
    }

    // per-case delta between best and current (ts_rank)
    const best = [...FUNCS].sort(
        (a, b) => results[b].mrrAtK[1] - results[a].mrrAtK[1],
    )[0];
    console.log(`\nbest by mrr@1: ${best}`);
    if (best !== "ts_rank") {
        console.log("\nper-case rank delta (best vs ts_rank, '-' = miss):");
        for (const c of cases) {
            const docIds = (fn: string) =>
                uniqueDocumentIds(rankedByCase[c.id][fn].map((id) => ({ id, documentId: docOf.get(id) ?? "" })).filter((x) => x.documentId));
            const rk = (fn: string) => {
                const ids = docIds(fn);
                for (let i = 0; i < ids.length; i++) if (c.expectedDocumentIds.includes(ids[i])) return i + 1;
                return null;
            };
            const a = rk(best);
            const b = rk("ts_rank");
            if (a !== b) console.log(`  ${c.id.padEnd(14)} ${best}=${a ?? "-"}  ts_rank=${b ?? "-"}`);
        }
    }

    // save report
    const report = {
        createdAt: new Date().toISOString(),
        tenantId,
        topN: TOP_N,
        reference: { ftsOnlyBaseline: { recallAtK1: 0.661, mrrAtK1: 0.806 }, hybridBaseline: { mrrAtK1: 0.808 } },
        results: Object.fromEntries(
            Object.entries(results).map(([fn, m]) => [
                fn,
                {
                    recallAtK: Object.fromEntries(Object.entries(m.recallAtK).map(([k, v]) => [Number(k), Number((v as number).toFixed(4))])),
                    mrrAtK: Object.fromEntries(Object.entries(m.mrrAtK).map(([k, v]) => [Number(k), Number((v as number).toFixed(4))])),
                },
            ]),
        ),
    };
    Deno.mkdirSync("./benchmark/results", { recursive: true });
    const outPath = `./benchmark/results/fts-rank-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    Deno.writeTextFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Saved report: ${outPath}`);
}

await main();
