import httpx
import datetime
from core.config import settings

def get_supabase_headers():
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise ValueError("Supabase credentials missing")
    return {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

def get_upstash_headers():
    if not settings.UPSTASH_VECTOR_REST_URL or not settings.UPSTASH_VECTOR_REST_TOKEN:
        raise ValueError("Upstash credentials missing")
    return {
        "Authorization": f"Bearer {settings.UPSTASH_VECTOR_REST_TOKEN}",
        "Content-Type": "application/json",
    }

def check_document_idempotency(document_id: str) -> bool:
    """
    Check if the document is already processed to prevent duplicate embeddings.
    Returns True if already processed.
    """
    url = f"{settings.SUPABASE_URL}/rest/v1/documents?id=eq.{document_id}&select=status"
    with httpx.Client() as client:
        res = client.get(url, headers=get_supabase_headers())
        res.raise_for_status()
        data = res.json()
        if len(data) > 0 and data[0].get("status") == "processed":
            return True
    return False

def fetch_documents_needing_ingestion(limit: int = 100) -> list[dict]:
    """
    Fetch documents that were queued for ingestion but never finished, used to
    re-hydrate the in-process queue after a worker restart. Only 'confirmed'
    documents are picked: 'pending' files may not have been uploaded yet, and
    terminal states (processed / failed / failed_vectorizing) are handled
    elsewhere. The processor's idempotency check makes duplicate enqueues
    harmless, so this is safe to run on every startup.
    """
    url = (
        f"{settings.SUPABASE_URL}/rest/v1/documents"
        f"?status=eq.confirmed&select=id,tenant_id&limit={limit}"
    )
    with httpx.Client() as client:
        res = client.get(url, headers=get_supabase_headers())
        res.raise_for_status()
        return res.json()

def get_last_processed_chunk_index(document_id: str) -> int:
    """
    Query Supabase to find the highest chunk_index already inserted for this document.
    Returns -1 if no chunks exist. Used for resuming 'quota_exhausted' documents.
    """
    url = f"{settings.SUPABASE_URL}/rest/v1/document_chunks?document_id=eq.{document_id}&select=chunk_index&order=chunk_index.desc&limit=1"
    with httpx.Client() as client:
        res = client.get(url, headers=get_supabase_headers())
        res.raise_for_status()
        data = res.json()
        if len(data) > 0:
            return data[0]["chunk_index"]
    return -1

def mark_document_processed(document_id: str, description: str = ""):
    """
    Update the document status to 'processed' and set the LLM generated description.
    """
    url = f"{settings.SUPABASE_URL}/rest/v1/documents?id=eq.{document_id}"
    headers = get_supabase_headers()
    headers["Prefer"] = "return=representation"
    
    payload = {
        "status": "processed",
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    if description:
        payload["description"] = description
        
    with httpx.Client() as client:
        res = client.patch(url, headers=headers, json=payload)
        res.raise_for_status()

def mark_document_queued(document_id: str):
    """
    Update the document status to 'quota_exhausted' when the daily Cloudflare
    token quota (TPD) is depleted mid-job. The document will be retried
    the next day when the quota resets at UTC 00:00.
    """
    url = f"{settings.SUPABASE_URL}/rest/v1/documents?id=eq.{document_id}"
    headers = get_supabase_headers()
    headers["Prefer"] = "return=representation"

    with httpx.Client() as client:
        res = client.patch(url, headers=headers, json={
            "status": "quota_exhausted",
            "updated_at": datetime.datetime.utcnow().isoformat() + "Z"
        })
        res.raise_for_status()

def mark_document_failed(document_id: str):
    """
    Update the document status to 'failed' when an unexpected error occurs
    during ingestion (e.g., PDF corrupt, MinIO unreachable, network error).
    Best-effort — swallows exceptions to avoid masking the original error.
    """
    url = f"{settings.SUPABASE_URL}/rest/v1/documents?id=eq.{document_id}"
    headers = get_supabase_headers()
    headers["Prefer"] = "return=representation"

    try:
        with httpx.Client() as client:
            res = client.patch(url, headers=headers, json={
                "status": "failed",
                "updated_at": datetime.datetime.utcnow().isoformat() + "Z"
            })
            res.raise_for_status()
    except Exception:
        pass  # Best-effort: do not mask the original error

def mark_document_failed_vectorizing(document_id: str, error_message: str = ""):
    """
    Update document status to 'failed_vectorizing' when embedding/vector processing fails.
    """
    url = f"{settings.SUPABASE_URL}/rest/v1/documents?id=eq.{document_id}"
    headers = get_supabase_headers()
    headers["Prefer"] = "return=representation"

    payload = {
        "status": "failed_vectorizing",
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z"
    }

    try:
        with httpx.Client() as client:
            res = client.patch(url, headers=headers, json=payload)
            res.raise_for_status()
    except Exception:
        pass

def insert_document_chunks(chunks_payload: list[dict]):
    """
    Insert the raw text chunks into Supabase Postgres `document_chunks` table.
    """
    if not chunks_payload:
        return
        
    url = f"{settings.SUPABASE_URL}/rest/v1/document_chunks"
    with httpx.Client() as client:
        # We can batch insert directly to PostgREST
        res = client.post(url, headers=get_supabase_headers(), json=chunks_payload)
        res.raise_for_status()

def upsert_vectors_to_upstash(upstash_payload: list[dict]):
    """
    Upsert the embedding vectors to Upstash Vector REST API.
    """
    if not upstash_payload:
        return
        
    url = f"{settings.UPSTASH_VECTOR_REST_URL}/upsert"
    with httpx.Client() as client:
        res = client.post(url, headers=get_upstash_headers(), json=upstash_payload)
        res.raise_for_status()
