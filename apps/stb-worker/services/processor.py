import os
import time
import uuid
import tempfile
import httpx
from core.config import settings
from services.storage import download_pdf
from services.extractor import extract_text_from_pdf, chunk_text
from services.embedding import generate_embedding_with_retry
from services.database import (
    check_document_idempotency,
    insert_document_chunks,
    upsert_vectors_to_upstash,
    mark_document_processed
)

# Load Lua script from external file
script_dir = os.path.dirname(__file__)
lua_path = os.path.join(script_dir, 'gatekeeper.lua')
with open(lua_path, 'r') as f:
    gatekeeper_lua = f.read()

def execute_gatekeeper(estimated_tokens: int):
    if not settings.UPSTASH_REDIS_REST_URL or not settings.UPSTASH_REDIS_REST_TOKEN:
        raise ValueError("UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set in .env")
        
    tpm_key = "ratelimit:gemini:tpm:global"
    rpm_key = "ratelimit:gemini:rpm:global"
    rpd_key = "ratelimit:gemini:rpd:global"
    
    url = f"{settings.UPSTASH_REDIS_REST_URL}"
    headers = {
        "Authorization": f"Bearer {settings.UPSTASH_REDIS_REST_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = ["EVAL", gatekeeper_lua, 3, tpm_key, rpm_key, rpd_key, estimated_tokens]
    
    with httpx.Client() as client:
        res = client.post(url, headers=headers, json=payload, timeout=10.0)
        res.raise_for_status()
        data = res.json()
        if "error" in data:
            raise Exception(f"Upstash Redis Error: {data['error']}")
        return data["result"]

def process_document(tenant_id: str, document_id: str):
    print(f"[Processor] Starting job for {document_id} (Tenant: {tenant_id})")
    
    if check_document_idempotency(document_id):
        print(f"[Processor] Document {document_id} is already processed. Skipping.")
        return
    
    if settings.WORKER_TMP_DIR and not os.path.exists(settings.WORKER_TMP_DIR):
        os.makedirs(settings.WORKER_TMP_DIR, exist_ok=True)
        
    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", dir=settings.WORKER_TMP_DIR)
    temp_pdf.close()
    
    try:
        print("1. Reading PDF from disk...")
        download_pdf(tenant_id, document_id, temp_pdf.name)
        
        full_text = extract_text_from_pdf(temp_pdf.name)
        
        print(f"2. PDF Parsed. Total Length: {len(full_text)}")
        
        chunks = chunk_text(full_text, chunk_size=1000, overlap=150)
        print(f"3. Chunking complete. Processing ALL {len(chunks)} chunks!")
        
        print(f"4. Document {document_id} is checked and inserted into Postgres.")
        
        if not settings.UPSTASH_REDIS_REST_URL or not settings.UPSTASH_REDIS_REST_TOKEN:
            raise ValueError("Missing UPSTASH_REDIS credentials in .env")
            
        print("5. Initialized Upstash Redis SDK. Starting Gatekeeper Loop...")
        
        upstash_payload = []
        postgres_payload = []
        
        for i, chunk_text_content in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            estimated_tokens = max(1, len(chunk_text_content) // 3)
            
            if estimated_tokens > 8192:
                print(f"[PAYLOAD_TOO_LARGE] Chunk {i} rejected. Size: {estimated_tokens} tokens.")
                continue
                
            gatekeeper_passed = False
            retry_count = 0
            
            while not gatekeeper_passed and retry_count < 3:
                status, reason, reset_in_ms = execute_gatekeeper(estimated_tokens)
                
                if status == 1:
                    gatekeeper_passed = True
                    print(f"[GATEKEEPER OK] Chunk {i+1}/{len(chunks)} ({estimated_tokens} tk) => Deducted. Processing...")
                else:
                    wait_ms = max(100, reset_in_ms + 100)
                    wait_sec = (wait_ms + 999) // 1000
                    print(f"[GATEKEEPER THROTTLE] {reason}. Sleeping for {wait_sec}s...")
                    time.sleep(wait_sec)
                    retry_count += 1
                    
            if not gatekeeper_passed:
                print(f"[Processor WARNING] Gatekeeper failed after retries for chunk {i+1}. Skipping chunk.")
                continue
            
            vector = generate_embedding_with_retry(chunk_text_content)
            
            upstash_payload.append({
                "id": chunk_id,
                "vector": vector,
                "metadata": {
                    "tenantId": tenant_id,
                    "documentId": document_id,
                    "chunkIndex": i,
                    "content": chunk_text_content
                }
            })
            
            postgres_payload.append({
                "id": chunk_id,
                "tenant_id": tenant_id,
                "document_id": document_id,
                "chunk_index": i,
                "content": chunk_text_content
            })
            
            if len(upstash_payload) >= 50 or i == len(chunks) - 1:
                print(f"-> Flushing {len(upstash_payload)} vectors to Upstash...")
                insert_document_chunks(postgres_payload)
                upsert_vectors_to_upstash(upstash_payload)
                
                upstash_payload = []
                postgres_payload = []
                
        mark_document_processed(document_id)
        print("7. All chunks processed and upserted successfully!")
        
    except Exception as e:
        print(f"[Processor ERROR] Failed to process {document_id}: {str(e)}")
    finally:
        if os.path.exists(temp_pdf.name):
            os.remove(temp_pdf.name)
