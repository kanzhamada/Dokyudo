import { redis } from "../config/redis.ts";
import { CB_DEFAULTS } from "../shared/constants/circuit_breaker.constant.ts";

export type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  windowMs: number;
  openDurationMs: number;
  halfOpenProbes: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(instance: string) {
    super(`Circuit breaker [${instance}] is OPEN`);
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreaker {
  private instance: string;
  private config: CircuitBreakerConfig;

  constructor(instance: string, config: CircuitBreakerConfig) {
    this.instance = instance;
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const failuresKey = `cb:${this.instance}:failures`;
    const stateKey = `cb:${this.instance}:state`;
    const openUntilKey = `cb:${this.instance}:open_until`;

    // 1. Check state using Redis pipeline
    const p1 = redis.pipeline();
    p1.get<CBState>(stateKey);
    p1.get<number>(openUntilKey);
    p1.get<number>(failuresKey);
    
    const [state, openUntil, currentFailures] = await p1.exec<[CBState | null, number | null, number | null]>();
    const currentState = state || "CLOSED";
    const now = Date.now();

    // 2. Handle OPEN state
    if (currentState === "OPEN") {
      if (openUntil && now > openUntil) {
        // Time to probe, transition to HALF_OPEN
        await redis.set(stateKey, "HALF_OPEN");
        this.logStateChange("OPEN", "HALF_OPEN", currentFailures || 0);
      } else {
        // Still OPEN, fail fast
        throw new CircuitBreakerOpenError(this.instance);
      }
    }

    // 3. Execute function
    try {
      const result = await fn();
      
      // Success handling
      if (currentState === "HALF_OPEN" || (currentState === "OPEN" && openUntil && now > openUntil)) {
        const p2 = redis.pipeline();
        p2.set(stateKey, "CLOSED");
        p2.del(failuresKey);
        p2.del(openUntilKey);
        await p2.exec();
        this.logStateChange("HALF_OPEN", "CLOSED", 0);
      } else if (currentFailures && currentFailures > 0) {
        // Reset failures on success if we were in CLOSED state
        await redis.del(failuresKey);
      }

      return result;
    } catch (error) {
      // Failure handling
      const p3 = redis.pipeline();
      p3.incr(failuresKey);
      // Set TTL for the failure sliding window
      p3.pexpire(failuresKey, this.config.windowMs);
      
      const [newFailures] = await p3.exec<[number, number]>();
      
      const effectiveState = (currentState === "OPEN" && openUntil && now > openUntil) ? "HALF_OPEN" : currentState;

      if (effectiveState === "HALF_OPEN" || newFailures >= this.config.failureThreshold) {
        const p4 = redis.pipeline();
        p4.set(stateKey, "OPEN");
        p4.set(openUntilKey, now + this.config.openDurationMs);
        await p4.exec();
        
        if (effectiveState !== "OPEN") {
            this.logStateChange(effectiveState, "OPEN", newFailures);
        }
      }
      
      throw error;
    }
  }

  private logStateChange(from: CBState, to: CBState, failureCount: number) {
    const logEntry = {
      event: "circuit_breaker_state_change",
      instance: this.instance,
      from,
      to,
      failureCount,
      windowMs: this.config.windowMs,
      timestamp: new Date().toISOString()
    };
    // Structured wide event log
    console.log(JSON.stringify(logEntry));
  }
}

export function createCircuitBreaker(instance: string, config: CircuitBreakerConfig = CB_DEFAULTS): CircuitBreaker {
  return new CircuitBreaker(instance, config);
}
