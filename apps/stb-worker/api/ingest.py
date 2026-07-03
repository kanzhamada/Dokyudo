from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from services.queue import ingestion_queue, IngestionJob
from core.config import settings

router = APIRouter()

class IngestPayload(BaseModel):
    document_id: str
    tenant_id: str

class CancelPayload(BaseModel):
    document_id: str

@router.post("/ingest")
async def ingest_document(
    payload: IngestPayload, 
    x_worker_secret: str = Header(..., description="Secret key to authorize webhook")
):
    """
    Webhook receiver from Supabase pg_net.
    Returns 200 immediately and enqueues for sequential processing.
    """
    if x_worker_secret != settings.WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized STB Access")
    
    ingestion_queue.enqueue(IngestionJob(
        tenant_id=payload.tenant_id,
        document_id=payload.document_id,
    ))
    
    return {
        "message": "Ingestion task queued",
        "document_id": payload.document_id,
        "queue_depth": ingestion_queue.depth,
    }

@router.post("/cancel")
async def cancel_ingestion(
    payload: CancelPayload,
    x_worker_secret: str = Header(..., description="Secret key to authorize webhook")
):
    """
    Cancel a queued or active ingestion job.
    If the job is pending in queue, it will be skipped when dequeued.
    If the job is currently processing, it will abort at the next chunk boundary.
    """
    if x_worker_secret != settings.WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized STB Access")
    
    result = ingestion_queue.cancel(payload.document_id)
    
    return result
