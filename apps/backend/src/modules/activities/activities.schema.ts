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
