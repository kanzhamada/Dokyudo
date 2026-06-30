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

export async function handleDeleteDocument(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, logContext } = extractor.extractAuthContext();

    const params: DocumentSchema.DeleteDocumentParams = {
        tenantId,
        documentId: c.req.param("id"),
        logContext,
    };

    const result = await DocumentsService.deleteDocument(params);

    return c.json({ data: result }, 200);
}

export async function handleListDocuments(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, logContext } = extractor.extractAuthContext();

    const params: DocumentSchema.ListDocumentsParams = {
        tenantId,
        logContext,
    };

    const result = await DocumentsService.listDocuments(params);

    return c.json(result, 200);
}
