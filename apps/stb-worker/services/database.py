import httpx
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

def mark_document_processed(document_id: str):
    """
    Update the document status to 'processed'.
    """
    url = f"{settings.SUPABASE_URL}/rest/v1/documents?id=eq.{document_id}"
    headers = get_supabase_headers()
    headers["Prefer"] = "return=representation"
    
    with httpx.Client() as client:
        res = client.patch(url, headers=headers, json={"status": "processed"})
        res.raise_for_status()

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
