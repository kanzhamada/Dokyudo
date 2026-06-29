import { Context } from "hono";
import { AppError } from "../../shared/utils/errors.util.ts";
import { DocumentsService } from "./documents.service.ts";
import { ContextExtractor } from "../../shared/utils/context.util.ts";

export async function handleGeneratePresignedUrl(c: Context) {
    const { tenantId } = new ContextExtractor(c).extractAuthContext();

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

export async function handleConfirmUpload(c: Context) {
    const { tenantId } = new ContextExtractor(c).extractAuthContext();

    const body = await c.req.json();
    const { documentId } = body;
    
    const result = await DocumentsService.confirmUpload(tenantId, documentId);

    return c.json(result, 200);
}
