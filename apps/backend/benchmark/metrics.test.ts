import { assertEquals } from "jsr:@std/assert";
import { mean, mrrAtK, percentile, recallAtK, uniqueDocumentIds } from "./metrics.ts";

Deno.test("uniqueDocumentIds returns first-seen order, no duplicates", () => {
    assertEquals(
        uniqueDocumentIds([
            { id: "c1", documentId: "d1" },
            { id: "c2", documentId: "d2" },
            { id: "c3", documentId: "d1" },
        ]),
        ["d1", "d2"],
    );
    assertEquals(uniqueDocumentIds([]), []);
});

Deno.test("recallAtK counts golden docs found in top-k", () => {
    const ranked = ["d1", "d2", "d3", "d4"];
    assertEquals(recallAtK(["d4", "d1"], ranked, 1), 0.5);
    assertEquals(recallAtK(["d4", "d1"], ranked, 2), 0.5);
    assertEquals(recallAtK(["d4", "d1"], ranked, 4), 1);
    assertEquals(recallAtK(["d1"], ranked, 0), 0);
    assertEquals(recallAtK([], ranked, 5), 0);
});

Deno.test("mrrAtK returns reciprocal rank of the first golden doc in top-k", () => {
    const ranked = ["d1", "d2", "d3", "d4"];
    assertEquals(mrrAtK(["d2"], ranked, 5), 0.5);
    assertEquals(mrrAtK(["d9"], ranked, 5), 0);
    assertEquals(mrrAtK(["d3", "d1"], ranked, 2), 1); // d1 at rank 1
    assertEquals(mrrAtK(["d3"], ranked, 2), 0); // d3 not in top-2
});

Deno.test("mean and percentile", () => {
    assertEquals(mean([1, 2, 3, 4]), 2.5);
    assertEquals(mean([]), 0);
    assertEquals(percentile([1, 2, 3, 4], 50), 2.5);
    assertEquals(percentile([5], 95), 5);
    assertEquals(percentile([], 95), 0);
});
