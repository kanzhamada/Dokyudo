/**
 * RAG Retrieval Benchmark (baseline + fusion sweep harness).
 *
 * Runs the production hybrid search pipeline against a golden evaluation set and
 * reports recall@k, MRR@k and latency.
 *
 * Single-config mode (default — same as before):
 *   deno task benchmark -- --tenant <TENANT_ID> [--k 60] [--fts-weight 1] [--vector-weight 1]
 *
 * Sweep mode (many fusion configs, ONE search call per case — quota-efficient):
 *   deno task benchmark -- --tenant <TENANT_ID> --configs '[
 *     {"k":10},{"k":30},{"k":60},{"k":100},
 *     {"k":60,"ftsWeight":2},{"k":60,"vectorWeight":2}
 *   ]'
 *
 * Environment fallbacks: BENCHMARK_TENANT_ID, BENCHMARK_EVAL_SET.
 *
 * See benchmark/README.md.
 */
import { SearchService } from "../src/modules/search/search.service.ts";
import { DEFAULT_FUSION, type FusionConfig } from "../src/modules/search/rrf.ts";
import {
    mean,
    mrrAtK,
    percentile,
    recallAtK,
    uniqueDocumentIds,
} from "./metrics.ts";

const DEFAULT_KS = [1, 3, 5, 10];
const DEFAULT_LIMIT = 10;

interface EvalCase {
    id: string;
    query: string;
    expectedDocumentIds: string[];
    expectedChunkIds?: string[];
}

interface EvalSet {
    name?: string;
    cases: EvalCase[];
}

interface ParsedArgs {
    tenantId: string;
    evalSetPath: string;
    ks: number[];
    limit: number;
    configs: FusionConfig[];
}

function parseArgs(argv: string[]): ParsedArgs {
    const arg = (flag: string): string | undefined => {
        const idx = argv.indexOf(flag);
        return idx >= 0 ? argv[idx + 1] : undefined;
    };

    const tenantId = arg("--tenant") ?? Deno.env.get("BENCHMARK_TENANT_ID") ?? "";
    const evalSetPath =
        arg("--eval-set") ??
        Deno.env.get("BENCHMARK_EVAL_SET") ??
        "./benchmark/eval_set.json";
    const limit = Number(arg("--limit") ?? DEFAULT_LIMIT);
    const ksArg = arg("--ks");
    const ks = ksArg ? ksArg.split(",").map((s) => Number(s.trim())) : DEFAULT_KS;

    if (!tenantId) {
        throw new Error(
            "Missing tenant id: pass --tenant <TENANT_ID> or set BENCHMARK_TENANT_ID.",
        );
    }
    if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
        throw new Error("--limit must be an integer in [1, 50].");
    }
    if (ks.length === 0 || ks.some((k) => !Number.isFinite(k) || k < 1)) {
        throw new Error("--ks must be a comma-separated list of positive integers.");
    }

    const configs = parseConfigs(argv);
    return { tenantId, evalSetPath, ks: [...new Set(ks)].sort((a, b) => a - b), limit, configs };
}

function parseConfigs(argv: string[]): FusionConfig[] {
    const args = argv.filter((a) => a !== "--");
    const flagArg = (flag: string): string | undefined => {
        const idx = args.indexOf(flag);
        return idx >= 0 ? args[idx + 1] : undefined;
    };

    const configsArg = flagArg("--configs");

    if (configsArg) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(configsArg);
        } catch {
            throw new Error("--configs must be a valid JSON array, e.g. '[{\"k\":60}]'");
        }
        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error("--configs must be a non-empty array of fusion configs.");
        }
        return parsed.map((c: any) => {
            const cfg = {
                k: Number(c?.k ?? DEFAULT_FUSION.k),
                ftsWeight: Number(c?.ftsWeight ?? DEFAULT_FUSION.ftsWeight),
                vectorWeight: Number(c?.vectorWeight ?? DEFAULT_FUSION.vectorWeight),
            };
            if (
                !Number.isFinite(cfg.k) || cfg.k < 1 ||
                !Number.isFinite(cfg.ftsWeight) || cfg.ftsWeight < 0 ||
                !Number.isFinite(cfg.vectorWeight) || cfg.vectorWeight < 0
            ) {
                throw new Error(`Invalid fusion config: ${JSON.stringify(c)}`);
            }
            return cfg;
        });
    }

    const single: FusionConfig = {
        k: Number(flagArg("--k") ?? DEFAULT_FUSION.k),
        ftsWeight: Number(flagArg("--fts-weight") ?? DEFAULT_FUSION.ftsWeight),
        vectorWeight: Number(flagArg("--vector-weight") ?? DEFAULT_FUSION.vectorWeight),
    };
    if (
        !Number.isFinite(single.k) || single.k < 1 ||
        !Number.isFinite(single.ftsWeight) || single.ftsWeight < 0 ||
        !Number.isFinite(single.vectorWeight) || single.vectorWeight < 0
    ) {
        throw new Error("--k/--fts-weight/--vector-weight must be finite, k>=1, weights>=0.");
    }
    return [single];
}

function loadEvalSet(path: string): EvalSet {
    let raw: string;
    try {
        raw = Deno.readTextFileSync(path);
    } catch {
        throw new Error(
            `Cannot read eval set at "${path}". Copy benchmark/eval_set.template.json ` +
            "to benchmark/eval_set.json and fill in real queries + document ids (see README).",
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error(`Eval set "${path}" is not valid JSON: ${(err as Error).message}`);
    }

    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as EvalSet).cases)) {
        throw new Error(`Eval set "${path}" must be an object with a "cases" array.`);
    }

    const evalSet = parsed as EvalSet;
    if (evalSet.cases.length === 0) {
        throw new Error(`Eval set "${path}" has no cases.`);
    }

    for (const c of evalSet.cases) {
        if (
            !c ||
            typeof c.id !== "string" ||
            typeof c.query !== "string" ||
            !c.query.trim() ||
            !Array.isArray(c.expectedDocumentIds)
        ) {
            throw new Error(
                `Eval set case is missing "id", "query" or "expectedDocumentIds": ${JSON.stringify(c)}`,
            );
        }
    }

    return evalSet;
}

function formatPct(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
}

function configLabel(cfg: FusionConfig): string {
    return `k=${cfg.k},fts=${cfg.ftsWeight},vec=${cfg.vectorWeight}`;
}

interface PerConfigDocs {
    docIds: string[];
    chunkIds: string[];
}

interface CaseRecord {
    id: string;
    query: string;
    latencyMs: number;
    perConfig: PerConfigDocs[];
    searchEvent?: string;
}

function computeConfigMetrics(
    cases: EvalCase[],
    records: CaseRecord[],
    ks: number[],
    configIndex: number,
): { recallAtK: Record<number, number>; mrrAtK: Record<number, number> } {
    const recallAtKMap: Record<number, number> = {};
    const mrrAtKMap: Record<number, number> = {};
    for (const k of ks) {
        recallAtKMap[k] = mean(
            cases.map((c, i) =>
                recallAtK(c.expectedDocumentIds, records[i].perConfig[configIndex].docIds, k)
            ),
        );
        mrrAtKMap[k] = mean(
            cases.map((c, i) =>
                mrrAtK(c.expectedDocumentIds, records[i].perConfig[configIndex].docIds, k)
            ),
        );
    }
    return { recallAtK: recallAtKMap, mrrAtK: mrrAtKMap };
}

async function main(): Promise<void> {
    let args: ParsedArgs;
    try {
        args = parseArgs(Deno.args);
    } catch (err) {
        console.error(`[benchmark] ${(err as Error).message}`);
        Deno.exit(2);
    }

    let evalSet: EvalSet;
    try {
        evalSet = loadEvalSet(args.evalSetPath);
    } catch (err) {
        console.error(`[benchmark] ${(err as Error).message}`);
        Deno.exit(2);
    }

    const sweep = args.configs.length > 1;
    const labels = args.configs.map(configLabel);
    console.log(
        `[benchmark] eval set: ${evalSet.name ?? args.evalSetPath} (${evalSet.cases.length} cases)`,
    );
    console.log(`[benchmark] fusion configs: ${sweep ? labels.join(" | ") : labels[0]}`);
    if (evalSet.cases.length < 30) {
        console.warn(
            "[benchmark] WARNING: fewer than 30 cases — results are indicative, not conclusive. Target 30–50 for a solid baseline.",
        );
    }

    const maxK = Math.min(Math.max(...args.ks), args.limit);
    const startedAt = Date.now();
    const records: CaseRecord[] = [];
    let ftsFailures = 0;
    let vectorFailures = 0;

    for (const c of evalSet.cases) {
        const logContext: Record<string, unknown> = {};
        const t0 = performance.now();
        let perConfig: PerConfigDocs[] = [];
        let error: string | undefined;

        try {
            if (sweep) {
                const byConfig = await SearchService.executeHybridSearchForConfigs(
                    {
                        tenantId: args.tenantId,
                        query: c.query,
                        limit: maxK,
                        logContext,
                        skipQuota: true,
                    },
                    args.configs,
                );
                perConfig = byConfig.map((results) => ({
                    docIds: uniqueDocumentIds(results),
                    chunkIds: results.map((r) => r.id),
                }));
            } else {
                const cfg = args.configs[0];
                const results = await SearchService.executeHybridSearch({
                    tenantId: args.tenantId,
                    query: c.query,
                    limit: maxK,
                    logContext,
                    rrfK: cfg.k,
                    ftsWeight: cfg.ftsWeight,
                    vectorWeight: cfg.vectorWeight,
                    skipQuota: true,
                });
                perConfig = [
                    {
                        docIds: uniqueDocumentIds(results),
                        chunkIds: results.map((r) => r.id),
                    },
                ];
            }
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            // Record the case as a failure for every config instead of crashing.
            perConfig = args.configs.map(() => ({ docIds: [], chunkIds: [] }));
        }
        const latencyMs = performance.now() - t0;

        const event = logContext.searchEvent as string | undefined;
        if (event === "fts_search_failed_graceful_degradation") ftsFailures += 1;
        if (event === "vector_search_failed_graceful_degradation") vectorFailures += 1;

        records.push({
            id: c.id,
            query: c.query,
            latencyMs,
            perConfig,
            searchEvent: error ? `error: ${error}` : event,
        });
        console.log(
            `  [${c.id}] ${latencyMs.toFixed(0)}ms  docs=${perConfig[0]?.docIds.length ?? 0}` +
                (error ? `  ERROR: ${error}` : ""),
        );
    }

    const totalDurationMs = Date.now() - startedAt;
    const latencies = records.map((r) => r.latencyMs);
    const latency = {
        avgMs: mean(latencies),
        p50Ms: percentile(latencies, 50),
        p95Ms: percentile(latencies, 95),
        minMs: Math.min(...latencies),
        maxMs: Math.max(...latencies),
    };

    const metricsByConfig = args.configs.map((_, i) => computeConfigMetrics(evalSet.cases, records, args.ks, i));

    const report: Record<string, unknown> = {
        createdAt: new Date().toISOString(),
        name: evalSet.name ?? "untitled",
        tenantId: args.tenantId,
        config: {
            ks: args.ks,
            limit: maxK,
            evalSetPath: args.evalSetPath,
            fusionConfigs: args.configs,
        },
        latencyMs: {
            avg: Number(latency.avgMs.toFixed(2)),
            p50: Number(latency.p50Ms.toFixed(2)),
            p95: Number(latency.p95Ms.toFixed(2)),
            min: Number(latency.minMs.toFixed(2)),
            max: Number(latency.maxMs.toFixed(2)),
        },
        totalDurationMs,
        sourceFailures: { fts: ftsFailures, vector: vectorFailures },
    };

    if (sweep) {
        report.cases = records.map((r, i) => ({
            id: r.id,
            query: r.query,
            latencyMs: r.latencyMs,
            expectedDocumentIds: evalSet.cases[i].expectedDocumentIds,
            searchEvent: r.searchEvent,
            byConfig: Object.fromEntries(
                labels.map((label, ci) => [label, {
                    docIds: r.perConfig[ci].docIds,
                    chunkIds: r.perConfig[ci].chunkIds,
                }]),
            ),
        }));
        report.metricsByConfig = Object.fromEntries(
            labels.map((label, ci) => [
                label,
                {
                    recallAtK: Object.fromEntries(
                        Object.entries(metricsByConfig[ci].recallAtK).map(([k, v]) => [
                            Number(k),
                            Number((v as number).toFixed(4)),
                        ]),
                    ),
                    mrrAtK: Object.fromEntries(
                        Object.entries(metricsByConfig[ci].mrrAtK).map(([k, v]) => [
                            Number(k),
                            Number((v as number).toFixed(4)),
                        ]),
                    ),
                },
            ]),
        );
    } else {
        report.cases = records.map((r, i) => ({
            id: r.id,
            query: r.query,
            latencyMs: r.latencyMs,
            expectedDocumentIds: evalSet.cases[i].expectedDocumentIds,
            docIds: r.perConfig[0].docIds,
            chunkIds: r.perConfig[0].chunkIds,
            searchEvent: r.searchEvent,
        }));
        report.metrics = {
            recallAtK: Object.fromEntries(
                Object.entries(metricsByConfig[0].recallAtK).map(([k, v]) => [
                    Number(k),
                    Number((v as number).toFixed(4)),
                ]),
            ),
            mrrAtK: Object.fromEntries(
                Object.entries(metricsByConfig[0].mrrAtK).map(([k, v]) => [
                    Number(k),
                    Number((v as number).toFixed(4)),
                ]),
            ),
        };
    }

    const resultsDir = "./benchmark/results";
    Deno.mkdirSync(resultsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = `${resultsDir}/${sweep ? "sweep" : "baseline"}-${stamp}.json`;
    Deno.writeTextFileSync(outPath, JSON.stringify(report, null, 2));

    console.log("\n=== Summary ===");
    console.log(`Eval set          : ${report.name} (${evalSet.cases.length} cases)`);
    console.log(`Tenant            : ${args.tenantId}`);
    console.log(`Source failures   : fts=${ftsFailures} vector=${vectorFailures}`);
    if (sweep) {
        const header = ["config", "r@1", "r@3", "r@5", "mrr@1", "mrr@3", "mrr@5"]
            .map((h) => h.padEnd(12))
            .join("");
        console.log(header);
        for (const [ci, label] of labels.entries()) {
            const m = metricsByConfig[ci];
            const row = [
                label,
                formatPct(m.recallAtK[1] ?? 0),
                formatPct(m.recallAtK[3] ?? 0),
                formatPct(m.recallAtK[5] ?? 0),
                formatPct(m.mrrAtK[1] ?? 0),
                formatPct(m.mrrAtK[3] ?? 0),
                formatPct(m.mrrAtK[5] ?? 0),
            ].map((cell) => cell.padEnd(12));
            console.log(row.join(""));
        }
    } else {
        console.log(`recall@k          : ${Object.entries(metricsByConfig[0].recallAtK)
            .map(([k, v]) => `k=${k} ${formatPct(v as number)}`)
            .join(" | ")}`);
        console.log(`mrr@k             : ${Object.entries(metricsByConfig[0].mrrAtK)
            .map(([k, v]) => `k=${k} ${formatPct(v as number)}`)
            .join(" | ")}`);
    }
    console.log(
        `latency           : avg=${latency.avgMs.toFixed(1)}ms p50=${latency.p50Ms.toFixed(1)}ms p95=${latency.p95Ms.toFixed(1)}ms`,
    );
    console.log(`total duration    : ${totalDurationMs}ms`);
    console.log(`Saved report      : ${outPath}`);
}

await main();
