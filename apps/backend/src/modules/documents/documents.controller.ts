import { Context } from "hono";
import { AppError } from "../../shared/utils/errors.util.ts";
import { DocumentsService } from "./documents.service.ts";

export async function handleGeneratePresignedUrl(c: Context) {
    const tenantId = c.get("tenantId") as string;
    if (!tenantId) {
        throw new AppError({
            code: "UNAUTHORIZED",
            message: "Missing tenant context",
            status: 401,
        });
    }

    const body = await c.req.json();
    const { filename, mimeType, sizeBytes } = body;
    
    const result = await DocumentsService.createPresignedUrl(
        tenantId,
        filename,
        mimeType,
        sizeBytes
    );

    return c.json(result, 201);
}

