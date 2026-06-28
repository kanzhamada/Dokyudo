import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { AppError } from "./errors.util.ts";

describe("Errors Utility", () => {
    describe("AppError", () => {
        it("positive: creates an error with standard properties", () => {
            const error = new AppError({
                code: "VALIDATION_ERROR",
                message: "Invalid input",
                status: 400,
            });

            assertEquals(error.code, "VALIDATION_ERROR");
            assertEquals(error.message, "Invalid input");
            assertEquals(error.status, 400);
            assertEquals(error.retryAfter, undefined);
        });

        it("positive: formats to JSON envelope correctly", () => {
            const error = new AppError({
                code: "UNAUTHORIZED",
                message: "Missing token",
                status: 401,
            });

            const json = error.toJSON("req-id-123");
            assertEquals(json.error.code, "UNAUTHORIZED");
            assertEquals(json.error.message, "Missing token");
            assertEquals(json.error.requestId, "req-id-123");
            // @ts-ignore - Ensure retryAfter is omitted
            assertEquals(json.error.retryAfter, undefined);
        });

        it("positive: includes retryAfter when provided", () => {
            const error = new AppError({
                code: "RATE_LIMIT_EXCEEDED",
                message: "Too many requests",
                status: 429,
                retryAfter: 60,
            });

            const json = error.toJSON("req-id-456");
            assertEquals(json.error.retryAfter, 60);
        });
    });
});
