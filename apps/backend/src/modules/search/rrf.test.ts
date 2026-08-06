import { assertEquals } from "jsr:@std/assert";
import { DEFAULT_FUSION, fuseWithRRF } from "./rrf.ts";

Deno.test("fuseWithRRF default config (k=60, fts=2, vec=1) favors FTS", () => {
    const vector = [
        { id: "a", rank: 1 },
        { id: "b", rank: 2 },
    ];
    const fts = [
        { id: "b", rank: 1 },
        { id: "c", rank: 2 },
    ];

    const ranked = fuseWithRRF(vector, fts, DEFAULT_FUSION);
    // fts=2: a = 1/61, b = 2/62 + 1/61, c = 2/62 → b > c > a
    assertEquals(ranked.map((r) => r.id), ["b", "c", "a"]);
});

Deno.test("fuseWithRRF equal 1:1 weights reproduces original RRF k=60 behavior", () => {
    const vector = [
        { id: "a", rank: 1 },
        { id: "b", rank: 2 },
    ];
    const fts = [
        { id: "b", rank: 1 },
        { id: "c", rank: 2 },
    ];

    const ranked = fuseWithRRF(vector, fts, { k: 60, ftsWeight: 1, vectorWeight: 1 });
    // a = 1/61, b = 1/62 + 1/61, c = 1/62 → b > a > c
    assertEquals(ranked.map((r) => r.id), ["b", "a", "c"]);
    // Score sanity: b ≈ 0.03252, a ≈ 0.01639
    assertEquals(Number(ranked[0].score.toFixed(5)), 0.03252);
    assertEquals(Number(ranked[1].score.toFixed(5)), 0.01639);
});

Deno.test("fuseWithRRF ftsWeight tilts the ranking toward FTS", () => {
    // vector ranks a first; fts ranks b first
    const vector = [
        { id: "a", rank: 1 },
        { id: "b", rank: 50 },
    ];
    const fts = [
        { id: "b", rank: 1 },
        { id: "a", rank: 40 },
    ];

    const defaultRanked = fuseWithRRF(vector, fts, { k: 60, ftsWeight: 1, vectorWeight: 1 });
    // default: a = 1/61 + 1/100 ≈ 0.0264 > b = 1/110 + 1/61 ≈ 0.0255 → a first
    assertEquals(defaultRanked[0].id, "a");

    const ftsHeavy = fuseWithRRF(vector, fts, { k: 60, ftsWeight: 3, vectorWeight: 1 });
    // a = 1/61 + 3/100 ≈ 0.0464 < b = 1/110 + 3/61 ≈ 0.0583 → b first
    assertEquals(ftsHeavy[0].id, "b");
});

Deno.test("fuseWithRRF vectorWeight tilts the ranking toward vector", () => {
    const vector = [
        { id: "a", rank: 1 },
        { id: "b", rank: 50 },
    ];
    const fts = [
        { id: "b", rank: 1 },
        { id: "a", rank: 40 },
    ];

    const vectorHeavy = fuseWithRRF(vector, fts, { k: 60, ftsWeight: 1, vectorWeight: 3 });
    // a = 3/61 + 1/100 ≈ 0.0592 > b = 1/110 + 3/61 ≈ 0.0583 → a first (still),
    // but margin shrinks vs default — assert both configs keep a ahead.
    assertEquals(vectorHeavy[0].id, "a");
});

Deno.test("fuseWithRRF k scales scores but preserves relative order for symmetric inputs", () => {
    const vector = [
        { id: "a", rank: 1 },
        { id: "b", rank: 2 },
        { id: "c", rank: 3 },
    ];
    const fts = [
        { id: "c", rank: 1 },
        { id: "b", rank: 2 },
        { id: "a", rank: 3 },
    ];

    const smallK = fuseWithRRF(vector, fts, { k: 2, ftsWeight: 1, vectorWeight: 1 });
    const bigK = fuseWithRRF(vector, fts, { k: 100, ftsWeight: 1, vectorWeight: 1 });
    // a=c (symmetric), b strictly lower in both
    assertEquals(smallK.map((r) => r.id), ["a", "c", "b"]);
    assertEquals(bigK.map((r) => r.id), ["a", "c", "b"]);
    // Smaller k → scores more spread (top-rank dominance)
    const spreadSmall = smallK[0].score - smallK[2].score;
    const spreadBig = bigK[0].score - bigK[2].score;
    assertEquals(spreadSmall > spreadBig, true);
});

Deno.test("fuseWithRRF handles empty sources and duplicate ids across sources", () => {
    assertEquals(fuseWithRRF([], [], DEFAULT_FUSION), []);
    const ranked = fuseWithRRF(
        [{ id: "a", rank: 1 }],
        [{ id: "a", rank: 1 }],
        { k: 60, ftsWeight: 1, vectorWeight: 1 },
    );
    assertEquals(ranked.length, 1);
    assertEquals(ranked[0].id, "a");
    // merged score = 1/61 + 1/61
    assertEquals(Number(ranked[0].score.toFixed(5)), 0.03279);
});
