import { Context } from "hono";
import { DocumentsService } from "./documents.service.ts";
import { ContextExtractor } from "../../shared/utils/context.util.ts";
import * as DocumentSchema from "./documents.schema.ts";

export async function handleGeneratePresignedUrlBatch(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, logContext } = extractor.extractAuthContext();

    const body = extractor.extractValidJson<DocumentSchema.PresignedUrlBatchBody>();
    
    const params: DocumentSchema.CreatePresignedUrlBatchParams = {
        tenantId,
        files: body.files,
        logContext,
    };

    const result = await DocumentsService.createPresignedUrlBatch(params);

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

export async function handleGetDocumentPreview(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, logContext } = extractor.extractAuthContext();

    const params: DocumentSchema.GetDocumentPreviewParams = {
        tenantId,
        documentId: c.req.param("id"),
        logContext,
    };

    const result = await DocumentsService.getDocumentPreview(params);

    return c.json(result, 200);
}

export async function handleBatchDeleteDocuments(c: Context) {
    const extractor = new ContextExtractor(c);
    const { tenantId, logContext } = extractor.extractAuthContext();
    const body = extractor.extractValidJson<any>(); // Will be validated by OpenAPI middleware

    const params: DocumentSchema.BatchDeleteDocumentsParams = {
        tenantId,
        documentIds: body.documentIds,
        logContext,
    };

    const result = await DocumentsService.batchDeleteDocuments(params);

    return c.json(result, 200);
}
