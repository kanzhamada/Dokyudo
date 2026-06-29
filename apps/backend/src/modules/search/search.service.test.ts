import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { executeHybridSearch } from "./search.service.ts";
import { createCircuitBreaker, CircuitBreakerOpenError } from "../../infra/circuit-breaker.ts";

Deno.test("executeHybridSearch() - Positive: Execute search and return empty array for unknown tenant", async () => {
    assertExists(executeHybridSearch);
    
    const fakeTenant = crypto.randomUUID();
    const results = await executeHybridSearch(fakeTenant, "test query", 5);
    
    assertEquals(Array.isArray(results), true);
    assertEquals(results.length, 0); 
});

Deno.test("Circuit Breaker - Negative: Circuit trips after threshold and throws CircuitBreakerOpenError", async () => {
    // Generate a unique instance name to avoid Redis collisions during tests
    const instanceName = `test-cb-${crypto.randomUUID()}`;
    const cb = createCircuitBreaker(instanceName, {
        failureThreshold: 5,
        windowMs: 10000,
        openDurationMs: 5000,
        halfOpenProbes: 1
    });

    const failingFunction = async () => {
        throw new Error("Simulated API failure");
    };

    // Cause 5 failures
    for (let i = 0; i < 5; i++) {
        await assertRejects(
            async () => {
                await cb.execute(failingFunction);
            },
            Error,
            "Simulated API failure"
        );
    }

    // 6th call should instantly throw CircuitBreakerOpenError (Fail-Fast)
    await assertRejects(
        async () => {
            await cb.execute(failingFunction);
        },
        CircuitBreakerOpenError
    );
});
