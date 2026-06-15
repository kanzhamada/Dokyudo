---
trigger: model_decision
description: This rule mandates that every new, updated, or refactored service, helper function, or HTTP endpoint inside the Deno backend (`apps/backend/`) must be accompanied by comprehensive unit tests covering both positive and negative execution paths
---

# Backend Automated Unit Testing Policy

No backend task is considered "complete" until its corresponding test suite passes.

## Activation
- **Method**: Always On
- **Files**: `apps/backend/**/*.ts`
- **Exclusions**: Do not apply this rule to frontend SvelteKit code.

---

## 1. Core Testing Mandate

Whenever you write, fix, or modify backend code:
1. **Locate or Create the Test File**: Tests must live adjacent to the source code or follow the naming convention `[filename]_test.ts`.
2. **Use Native Tooling**: Write tests using Deno's native `Deno.test()` runner and assertions from the standard library (`jsr:@std/assert`).
3. **Run Pre-Flight**: Execute or simulate the execution of `deno test` before declaring code ready.

---

## 2. Test Coverage Matrix (Mandatory Scenarios)

Your test suites must validate the following layers using strict positive (happy path) and negative (edge/error path) cases:

### A. HTTP Requests & Routing (Hono Handlers)
*   **Positive**: Verify valid requests return the correct HTTP status code (`200 OK`, `201 Created`, `202 Accepted`) and exact headers.
*   **Negative**: Mock missing headers, invalid JWT structures, or expired sessions to ensure the API Gateway or middleware rejects requests instantly.

### B. Input Data Types & Edge Cases
*   **Type Exhaustion**: Test how functions handle missing fields, `null`, `undefined`, empty strings `""`, zero `0`, negative numbers, arrays with empty values, and unexpectedly large objects.
*   **Payload Bounds**: Check behavior against malicious inputs, excessively long strings, or malformed JSON payloads.

### C. File Uploads & Ingestion Pipeline
If a service handles file data or object storage pathways (such as the Ingestion Service):
*   **Extension Matrix**: You must test all supported file extensions defined in the PRD (`.pdf`, `.docx`, `.txt`) using mock file streams or buffers.
*   **Negative File Constraints**: 
    *   Test files exceeding the **25 MB limit** to guarantee a `VALIDATION_ERROR` is thrown.
    *   Test unsupported mime-types/extensions (e.g., `.exe`, `.png`, `.zip`) to ensure the Ingestion pipeline intercepts and rejects them before enqueuing jobs.

### D. Core Business Logic & Infrastructure Fallbacks
*   **Algorithmic Precision**: For the embedding worker, verify that the token chunking algorithm accurately produces a **512-token window with exactly 10-20% overlap**. For search, verify that the Reciprocal Rank Fusion (RRF) correctly merges SQL full-text and pgvector scores.
*   **Circuit Breakers & Error Standards**: Mock downstream failures (e.g., pgvector database timeout or OpenAI API disconnection). Verify that:
    1. The Circuit Breaker transitions states after 5 failures within a 10-second window.
    2. The service drops back to a graceful degradation mode (e.g., hybrid search falls back to full-text only).
    3. The returned error matches the PRD §5.12 JSON standard envelope precisely:
```json
        {
          "error": {
            "code": "MACHINE_READABLE_CODE",
            "message": "Human readable description",
            "retryAfter": 30,
            "requestId": "uuid"
          }
        }
        ```

---

## 3. Reference Deno Implementation Blueprint

When writing tests, follow this syntax schema using standard Deno assertions:

```typescript
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { processDocumentChunk } from "./chunker.ts";

Deno.test("processDocumentChunk() - Positive: slice within 512 token limits with overlap", () => {
  const sampleText = "Valid document content...";
  const result = processDocumentChunk(sampleText, { maxTokens: 512, overlap: 0.15 });
  
  assertEquals(result.success, true);
  assertEquals(result.chunks.length > 0, true);
});

Deno.test("processDocumentChunk() - Negative: throw validation error on files over 25MB", async () => {
  const massiveBuffer = new Uint8Array(26 * 1024 * 1024); // 26MB
  
  await assertRejects(
    async () => {
      await processDocumentChunk(massiveBuffer);
    },
    Error,
    "VALIDATION_ERROR"
  );
});

```