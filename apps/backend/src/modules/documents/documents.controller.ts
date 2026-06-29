import { Context } from "hono";
import { DocumentsService } from "./documents.service.ts";
import { ContextExtractor } from "../../shared/utils/context.util.ts";
import * as DocumentSchema from "./documents.schema.ts";

export async function handleGeneratePresignedUrl(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, logContext } = extractor.extractAuthContext();

    const body = extractor.extractValidJson<DocumentSchema.PresignedUrlBody>();
    
    const params: DocumentSchema.CreatePresignedUrlParams = {
        tenantId,
        filename: body.filename,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        logContext,
    };

    const result = await DocumentsService.createPresignedUrl(params);

    return c.json(result, 201);
}

export async function handleConfirmUpload(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, logContext } = extractor.extractAuthContext();

    const body = extractor.extractValidJson<DocumentSchema.ConfirmUploadBody>();
    
    const params: DocumentSchema.ConfirmUploadParams = {
        tenantId,
        documentId: body.documentId,
        logContext,
    };

    const result = await DocumentsService.confirmUpload(params);

    return c.json(result, 200);
}
