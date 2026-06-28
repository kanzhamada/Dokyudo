from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel
from services.processor import process_document
from core.config import settings

router = APIRouter()

class IngestPayload(BaseModel):
    document_id: str
    tenant_id: str

@router.post("/ingest")
async def ingest_document(
    payload: IngestPayload, 
    background_tasks: BackgroundTasks,
    x_worker_secret: str = Header(..., description="Secret key to authorize webhook")
):
    """
    Webhook receiver from Supabase pg_net.
    Returns 202 Accepted immediately and processes in the background.
    """
    if x_worker_secret != settings.WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized STB Access")
        
    background_tasks.add_task(process_document, payload.tenant_id, payload.document_id)
    return {"message": "Ingestion task queued", "document_id": payload.document_id}
