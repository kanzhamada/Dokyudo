import os
import re
import time
import uuid
import tempfile
import httpx
from concurrent.futures import ThreadPoolExecutor
from core.config import settings
from core.logger import dev_print
from services.storage import download_pdf
from services.extractor import extract_text_from_pdf, chunk_text_with_pages
from services.embedding import generate_embedding_with_retry
from services.llm import generate_llm_description
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

def is_valid_uuid(val: str) -> bool:
    pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    return bool(pattern.match(val))

def _process_chunks_loop(chunks, document_id, tenant_id):
    upstash_payload = []
    postgres_payload = []
    
    for i, parent_data in enumerate(chunks):
        parent_text_content = parent_data["text"]
        parent_pages = parent_data["pages"]
        children = parent_data.get("children", [])
        
        parent_id = str(uuid.uuid4())
        
        # Postgres payload (Parent Chunk)
        postgres_payload.append({
            "id": parent_id,
            "tenant_id": tenant_id,
            "document_id": document_id,
            "chunk_index": i,
            "metadata": { "pages": parent_pages, "type": "parent" },
            "content": parent_text_content
        })
        
        # Process Child Chunks
        for child_idx, child_data in enumerate(children):
            child_text = child_data["text"]
            child_id = str(uuid.uuid4())
            
            estimated_tokens = max(1, len(child_text) // 3)
            
            if estimated_tokens > 8192:
                dev_print(f"[PAYLOAD_TOO_LARGE] Parent {i} Child {child_idx} rejected. Size: {estimated_tokens} tokens.")
                continue
                
            gatekeeper_passed = False
            retry_count = 0
            
            while not gatekeeper_passed and retry_count < 3:
                status, reason, reset_in_ms = execute_gatekeeper(estimated_tokens)
                
                if status == 1:
                    gatekeeper_passed = True
                    dev_print(f"[GATEKEEPER OK] P:{i} C:{child_idx} ({estimated_tokens} tk) => Deducted.")
                else:
                    wait_ms = max(100, reset_in_ms + 100)
                    wait_sec = (wait_ms + 999) // 1000
                    dev_print(f"[GATEKEEPER THROTTLE] {reason}. Sleeping for {wait_sec}s...")
                    time.sleep(wait_sec)
                    retry_count += 1
                    
            if not gatekeeper_passed:
                dev_print(f"[Processor WARNING] Gatekeeper failed after retries for child {child_idx}. Skipping.")
                continue
            
            vector = generate_embedding_with_retry(child_text)
            
            upstash_payload.append({
                "id": child_id,
                "vector": vector,
                "metadata": {
                    "tenantId": tenant_id,
                    "documentId": document_id,
                    "parentId": parent_id,
                    "chunkIndex": i,
                    "childIndex": child_idx,
                    "pages": parent_pages,
                    "content": child_text
                }
            })
            
            if len(upstash_payload) >= 50:
                dev_print(f"-> Flushing {len(upstash_payload)} vectors to Upstash...")
                upsert_vectors_to_upstash(upstash_payload)
                upstash_payload = []
                
        if len(postgres_payload) >= 10 or i == len(chunks) - 1:
            dev_print(f"-> Flushing {len(postgres_payload)} parent chunks to Postgres...")
            insert_document_chunks(postgres_payload)
            postgres_payload = []
            
    # Final flush
    if upstash_payload:
        upsert_vectors_to_upstash(upstash_payload)
    if postgres_payload:
        insert_document_chunks(postgres_payload)

def process_document(tenant_id: str, document_id: str):
    if not is_valid_uuid(tenant_id) or not is_valid_uuid(document_id):
        dev_print(f"[SECURITY ALERT] Path Traversal blocked! Invalid input. tenant: {tenant_id}, doc: {document_id}")
        return
        
    dev_print(f"[Processor] Starting job for {document_id} (Tenant: {tenant_id})")
    
    if check_document_idempotency(document_id):
        dev_print(f"[Processor] Document {document_id} is already processed. Skipping.")
        return
    
    if settings.WORKER_TMP_DIR and not os.path.exists(settings.WORKER_TMP_DIR):
        os.makedirs(settings.WORKER_TMP_DIR, exist_ok=True)
        
    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", dir=settings.WORKER_TMP_DIR)
    temp_pdf.close()
    
    try:
        dev_print("1. Reading PDF from disk...")
        download_pdf(tenant_id, document_id, temp_pdf.name)
        
        pages = extract_text_from_pdf(temp_pdf.name)
        
        dev_print(f"2. PDF Parsed. Total Pages: {len(pages)}")
        
        chunks = chunk_text_with_pages(pages, parent_size=2000, child_size=400, overlap=150)
        dev_print(f"3. Chunking complete. Processing ALL {len(chunks)} chunks!")
        
        dev_print(f"4. Document {document_id} is checked and inserted into Postgres.")
        
        if not settings.UPSTASH_REDIS_REST_URL or not settings.UPSTASH_REDIS_REST_TOKEN:
            raise ValueError("Missing UPSTASH_REDIS credentials in .env")
            
        dev_print("5. Initialized Upstash Redis SDK. Starting Gatekeeper Loop...")
        
        # Get the first 3000 characters from the pages for description generation
        full_text = " ".join([p["text"] for p in pages])
        head_text = full_text[:3000]
        
        # Run chunk processing and LLM description in parallel using threads
        description = ""
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_chunks = executor.submit(_process_chunks_loop, chunks, document_id, tenant_id)
            future_llm = executor.submit(generate_llm_description, head_text)
            
            # Wait for both to finish
            future_chunks.result()
            description = future_llm.result()
            
        mark_document_processed(document_id, description)
        dev_print("7. All chunks processed and upserted successfully!")
        
    except Exception as e:
        dev_print(f"[Processor ERROR] Failed to process {document_id}: {str(e)}")
    finally:
        if os.path.exists(temp_pdf.name):
            os.remove(temp_pdf.name)
