import { z } from "@hono/zod-openapi";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z
        .string()
        .openapi({
          description: "Machine-readable error code",
          example: "VALIDATION_ERROR",
        }),
      message: z
        .string()
        .openapi({
          description: "Human-readable error description",
          example: "Invalid email format",
        }),
      retryAfter: z
        .number()
        .optional()
        .openapi({
          description: "Seconds until retry is safe (for rate limit errors)",
          example: 900,
        }),
      requestId: z
        .string()
        .uuid()
        .openapi({
          description: "Unique request ID for tracing",
          example: "550e8400-e29b-41d4-a716-446655440000",
        }),
    }),
  })
  .openapi("ErrorResponse");
