import { z } from "zod";

export const GetActivitiesQuerySchema = z.object({
    page: z.string().optional().default("1").openapi({
        description: "Page number for pagination",
        example: "1",
    }),
    limit: z.string().optional().default("10").openapi({
        description: "Items per page",
        example: "10",
    }),
    category: z.enum(["auth", "document", "billing", "tenant", "search"]).optional().openapi({
        description: "Filter by action category",
        example: "document",
    }),
    startDate: z.string().optional().openapi({
        description: "Filter by start date (ISO string)",
        example: "2026-07-01T00:00:00.000Z",
    }),
    endDate: z.string().optional().openapi({
        description: "Filter by end date (ISO string)",
        example: "2026-07-31T23:59:59.999Z",
    }),
    search: z.string().optional().openapi({
        description: "Search keyword for action, metadata, or IP",
        example: "harum_energy",
    }),
});

export const ActivityItemSchema = z.object({
    id: z.string().uuid(),
    action: z.string().openapi({
        example: "document.uploaded",
    }),
    resourceType: z.string().nullable().optional(),
    resourceId: z.string().nullable().optional(),
    metadata: z.any().nullable().optional(),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
    createdAt: z.string().datetime().openapi({
        example: "2024-01-01T00:00:00Z",
    }),
});

export const GetActivitiesResponseSchema = z.object({
    data: z.array(ActivityItemSchema),
    meta: z.object({
        page: z.number().openapi({ example: 1 }),
        limit: z.number().openapi({ example: 10 }),
        total: z.number().openapi({ example: 42 }),
        totalPages: z.number().openapi({ example: 5 }),
    }),
});

export type GetActivitiesQuery = z.infer<typeof GetActivitiesQuerySchema>;
export type GetActivitiesResponse = z.infer<typeof GetActivitiesResponseSchema>;
