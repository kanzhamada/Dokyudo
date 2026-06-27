import os
import uuid
import tempfile
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

def process_document(tenant_id: str, document_id: str):
    print(f"[Processor] Starting job for {document_id} (Tenant: {tenant_id})")
    
    # 0. Idempotency Check (prevent duplicate processing if webhook retries)
    if check_document_idempotency(document_id):
        print(f"[Processor] Document {document_id} is already processed. Skipping.")
        return
    
    if settings.WORKER_TMP_DIR and not os.path.exists(settings.WORKER_TMP_DIR):
        os.makedirs(settings.WORKER_TMP_DIR, exist_ok=True)
        
    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", dir=settings.WORKER_TMP_DIR)
    temp_pdf.close()
    
    try:
        # 1. Download
        download_pdf(tenant_id, document_id, temp_pdf.name)
        
        # 2. Extract
        full_text = extract_text_from_pdf(temp_pdf.name)
        
        # 3. Chunk
        print(f"[Processor] Chunking text (Total chars: {len(full_text)})")
        chunks = chunk_text(full_text, chunk_size=1000, overlap=150)
        print(f"[Processor] Produced {len(chunks)} chunks.")
        
        # 4. Embed & Upsert
        print(f"[Processor] Starting Vector Embedding for {len(chunks)} chunks...")
        
        upstash_payload = []
        postgres_payload = []
        
        for i, chunk_text_content in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            vector = generate_embedding_with_retry(chunk_text_content)
            
            # Format output for Upstash Vector
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
            
            # Format output for Supabase document_chunks
            postgres_payload.append({
                "id": chunk_id,
                "tenant_id": tenant_id,
                "document_id": document_id,
                "chunk_index": i,
                "content": chunk_text_content
            })
            
            # Batch flush every 50 chunks or at the very end
            if len(upstash_payload) >= 50 or i == len(chunks) - 1:
                print(f"[Processor] Flushing {len(upstash_payload)} vectors to DBs...")
                # Transaksional-ish: Insert raw text first, then vectors
                insert_document_chunks(postgres_payload)
                upsert_vectors_to_upstash(upstash_payload)
                
                # Reset payload buffer
                upstash_payload = []
                postgres_payload = []
                print(f"[Processor] Processed {i + 1}/{len(chunks)} chunks.")
                
        # 5. Mark Document as Processed
        mark_document_processed(document_id)
        print(f"[Processor] Successfully processed and marked {document_id} as done.")
        
    except Exception as e:
        print(f"[Processor ERROR] Failed to process {document_id}: {str(e)}")
    finally:
        if os.path.exists(temp_pdf.name):
            os.remove(temp_pdf.name)
