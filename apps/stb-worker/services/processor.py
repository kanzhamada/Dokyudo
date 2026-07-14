import os
import re
import time
import uuid
import tempfile
import httpx
from concurrent.futures import ThreadPoolExecutor
from core.config import settings
from core.logger import log_event
from services.storage import download_pdf
from services.extractor import extract_text_from_pdf, chunk_text_with_pages
from services.embedding import generate_embedding_with_retry
from services.llm import generate_llm_description
from services.database import (
    check_document_idempotency,
    insert_document_chunks,
    upsert_vectors_to_upstash,
    mark_document_processed,
    mark_document_queued,
    mark_document_failed,
    get_last_processed_chunk_index
)
from services.queue import ingestion_queue

# Load Lua script from external file
script_dir = os.path.dirname(__file__)
lua_path = os.path.join(script_dir, 'gatekeeper.lua')
with open(lua_path, 'r') as f:
    gatekeeper_lua = f.read()

def execute_gatekeeper(estimated_tokens: int):
    if not settings.UPSTASH_REDIS_REST_URL or not settings.UPSTASH_REDIS_REST_TOKEN:
        raise ValueError("UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set in .env")
        
    tpd_key = "ratelimit:cloudflare:tpd:global"
    
    url = f"{settings.UPSTASH_REDIS_REST_URL}"
    headers = {
        "Authorization": f"Bearer {settings.UPSTASH_REDIS_REST_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = ["EVAL", gatekeeper_lua, 1, tpd_key, estimated_tokens]
    
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

def _process_chunks_loop(chunks, document_id, tenant_id, start_chunk_idx=0):
    BATCH_SIZE = 32
    
    chunks_to_process = chunks[start_chunk_idx:]
    if not chunks_to_process:
        return True
        
    for batch_offset in range(0, len(chunks_to_process), BATCH_SIZE):
        batch_chunks = chunks_to_process[batch_offset:batch_offset + BATCH_SIZE]
        
        # --- Cancellation check at each batch boundary ---
        if ingestion_queue.is_cancelled(document_id):
            log_event("processor.batch_cancelled", "Cancellation detected at batch boundary. Discarding.", level="WARNING", document_id=document_id, tenant_id=tenant_id, batch_number=(start_chunk_idx + batch_offset)//BATCH_SIZE + 1)
            return False
            
        batch_texts = [c["text"] for c in batch_chunks]
        total_estimated_tokens = sum(max(1, len(txt) // 3) for txt in batch_texts)
        
        gatekeeper_passed = False
        retry_count = 0
        
        while not gatekeeper_passed and retry_count < 3:
            status, reason, reset_in_ms = execute_gatekeeper(total_estimated_tokens)
            
            if status == 1:
                gatekeeper_passed = True
                log_event("gatekeeper.quota_deducted", "Gatekeeper passed, token quota deducted.", document_id=document_id, tenant_id=tenant_id, batch_number=(start_chunk_idx + batch_offset)//BATCH_SIZE + 1, estimated_tokens=total_estimated_tokens)
            else:
                if "TPD_EXHAUSTED" in reason:
                    log_event("gatekeeper.quota_exhausted", "Daily CF Quota Exceeded. Aborting job.", level="ERROR", document_id=document_id, tenant_id=tenant_id)
                    raise RuntimeError("TPD_EXHAUSTED")
                    
                wait_ms = max(100, reset_in_ms + 100)
                wait_sec = (wait_ms + 999) // 1000
                log_event("gatekeeper.throttled", "Rate limit hit, sleeping before retry.", level="WARNING", document_id=document_id, tenant_id=tenant_id, wait_seconds=wait_sec, reason=reason)
                time.sleep(wait_sec)
                retry_count += 1
                
        if not gatekeeper_passed:
            log_event("processor.gatekeeper_failed", "Gatekeeper failed after retries. Skipping batch.", level="ERROR", document_id=document_id, tenant_id=tenant_id, batch_number=(start_chunk_idx + batch_offset)//BATCH_SIZE + 1)
            continue
            
        vectors = generate_embedding_with_retry(batch_texts)
        
        upstash_payload = []
        postgres_payload = []
        
        for i, vector in enumerate(vectors):
            chunk_data = batch_chunks[i]
            global_chunk_index = start_chunk_idx + batch_offset + i
            chunk_id = str(uuid.uuid4())
            
            upstash_payload.append({
                "id": chunk_id,
                "vector": vector,
                "metadata": {
                    "tenantId": tenant_id,
                    "documentId": document_id,
                    "chunkIndex": global_chunk_index,
                    "pages": chunk_data["pages"],
                    "content": chunk_data["text"]
                }
            })
            
            postgres_payload.append({
                "id": chunk_id,
                "tenant_id": tenant_id,
                "document_id": document_id,
                "chunk_index": global_chunk_index,
                "metadata": { "pages": chunk_data["pages"] },
                "content": chunk_data["text"]
            })
            
        log_event("processor.flush_batch", "Flushing batch of vectors to DB and Upstash.", document_id=document_id, tenant_id=tenant_id, vectors_count=len(upstash_payload))
        insert_document_chunks(postgres_payload)
        upsert_vectors_to_upstash(upstash_payload)

    return True  # Signal completion

def process_document(tenant_id: str, document_id: str):
    if not is_valid_uuid(tenant_id) or not is_valid_uuid(document_id):
        log_event("security.path_traversal", "Path Traversal blocked due to invalid UUID input.", level="ERROR", tenant_id=tenant_id, document_id=document_id)
        return
        
    log_event("processor.job_started", "Starting document ingestion job.", document_id=document_id, tenant_id=tenant_id)
    
    if check_document_idempotency(document_id):
        log_event("processor.job_skipped", "Document is already processed. Skipping.", document_id=document_id, tenant_id=tenant_id)
        return
    
    if settings.WORKER_TMP_DIR and not os.path.exists(settings.WORKER_TMP_DIR):
        os.makedirs(settings.WORKER_TMP_DIR, exist_ok=True)
        
    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", dir=settings.WORKER_TMP_DIR)
    temp_pdf.close()
    
    try:
        log_event("processor.step1_downloading", "Reading PDF from disk...", document_id=document_id, tenant_id=tenant_id)
        download_pdf(tenant_id, document_id, temp_pdf.name)
        
        pages = extract_text_from_pdf(temp_pdf.name)
        
        log_event("processor.step2_parsed", "PDF Parsed successfully.", document_id=document_id, tenant_id=tenant_id, total_pages=len(pages))
        
        chunks = chunk_text_with_pages(pages, chunk_size=1000, overlap=150)
        log_event("processor.step3_chunking", "Chunking complete.", document_id=document_id, tenant_id=tenant_id, total_chunks=len(chunks))
        
        # Check cancellation before starting expensive embedding loop
        if ingestion_queue.is_cancelled(document_id):
            log_event("processor.job_cancelled", "Cancellation detected before embedding loop.", level="WARNING", document_id=document_id, tenant_id=tenant_id)
            return
        
        log_event("processor.step4_postgres", "Document checked and inserted into Postgres.", document_id=document_id, tenant_id=tenant_id)
        
        if not settings.UPSTASH_REDIS_REST_URL or not settings.UPSTASH_REDIS_REST_TOKEN:
            raise ValueError("Missing UPSTASH_REDIS credentials in .env")
            
        # Resume from checkpoint if this is a retry of quota_exhausted
        last_chunk_index = get_last_processed_chunk_index(document_id)
        start_chunk_idx = last_chunk_index + 1
        if start_chunk_idx > 0:
            log_event("processor.step5_resuming", "Found existing chunks. Resuming from checkpoint.", document_id=document_id, tenant_id=tenant_id, start_chunk_idx=start_chunk_idx)
        else:
            log_event("processor.step5_gatekeeper", "Initialized Upstash Redis SDK. Starting Gatekeeper Loop.", document_id=document_id, tenant_id=tenant_id)
        
        # Get the first 3000 characters from the pages for description generation
        full_text = " ".join([p["text"] for p in pages])
        head_text = full_text[:3000]
        
        # Run chunk processing and LLM description in parallel using threads
        description = ""
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_chunks = executor.submit(_process_chunks_loop, chunks, document_id, tenant_id, start_chunk_idx)
            future_llm = executor.submit(generate_llm_description, head_text)
            
            # Wait for both to finish
            completed = future_chunks.result()
            description = future_llm.result()
        
        if not completed:
            log_event("processor.job_cancelled_post", "Job was cancelled during execution. Skipping mark_document_processed.", level="WARNING", document_id=document_id, tenant_id=tenant_id)
            return
            
        mark_document_processed(document_id, description)
        log_event("processor.step7_completed", "All chunks processed and upserted successfully.", document_id=document_id, tenant_id=tenant_id)
        
    except RuntimeError as e:
        if "TPD_EXHAUSTED" in str(e):
            log_event("processor.quota_exhausted", "Quota exhausted during processing. Marking for retry tomorrow.", level="WARNING", document_id=document_id, tenant_id=tenant_id)
            mark_document_queued(document_id)
        else:
            log_event("processor.runtime_error", "Runtime error occurred during processing.", level="ERROR", document_id=document_id, tenant_id=tenant_id, error=str(e))
            mark_document_failed(document_id)
    except Exception as e:
        log_event("processor.fatal_error", "Failed to process document due to unhandled exception.", level="ERROR", document_id=document_id, tenant_id=tenant_id, error=str(e))
        mark_document_failed(document_id)
    finally:
        if os.path.exists(temp_pdf.name):
            os.remove(temp_pdf.name)
