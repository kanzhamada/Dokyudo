from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from services.processor import process_document

router = APIRouter()

class IngestPayload(BaseModel):
    document_id: str
    tenant_id: str

@router.post("/ingest")
async def ingest_document(payload: IngestPayload, background_tasks: BackgroundTasks):
    """
    Webhook receiver from Supabase pg_net.
    Returns 202 Accepted immediately and processes in the background.
    """
    background_tasks.add_task(process_document, payload.tenant_id, payload.document_id)
    return {"message": "Ingestion task queued", "document_id": payload.document_id}
