import os
import tempfile
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import boto3
import fitz  # PyMuPDF
import tiktoken
from botocore.client import Config
from dotenv import load_dotenv

load_dotenv() # Load variables from .env file

app = FastAPI(title="Dokyudo STB Worker")

class IngestPayload(BaseModel):
    document_id: str
    tenant_id: str

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=os.getenv('S3_ENDPOINT', 'http://127.0.0.1:9000'),
        aws_access_key_id=os.getenv('S3_ACCESS_KEY', 'admin_dokyudo'),
        aws_secret_access_key=os.getenv('S3_SECRET_KEY', 'KPcGu4OH$ZO#Ap'),
        config=Config(signature_version='s3v4'),
        region_name='us-east-1'
    )

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150):
    """
    Splits text into chunks of `chunk_size` tokens with an `overlap`.
    """
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)

    chunks = []
    i = 0
    while i < len(tokens):
        chunk_tokens = tokens[i:i + chunk_size]
        chunks.append(enc.decode(chunk_tokens))
        i += chunk_size - overlap

    return chunks

def process_document(tenant_id: str, document_id: str):
    """
    Background task to download, extract, and chunk a PDF document.
    """
    print(f"[Worker] Starting extraction for {document_id} (Tenant: {tenant_id})")
    s3 = get_s3_client()
    bucket = os.getenv('S3_BUCKET_NAME', 'dokyudo-documents')

    # In Dokyudo, the object key is typically tenant_id/uuid.pdf
    # We will assume .pdf for now, but in production, we might need to check the DB for the exact path.
    object_key = f"{tenant_id}/{document_id}.pdf"

    # 1. Download PDF to a temporary file (memory efficient)
    # Gunakan direktori temp khusus (jika ada di .env) agar tidak memakan RAM (/tmp biasanya tmpfs)
    custom_tmp = os.getenv('WORKER_TMP_DIR')
    if custom_tmp and not os.path.exists(custom_tmp):
        os.makedirs(custom_tmp, exist_ok=True)
        
    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", dir=custom_tmp)
    temp_pdf.close()

    try:
        print(f"[Worker] Downloading {object_key} to {temp_pdf.name}")
        s3.download_file(bucket, object_key, temp_pdf.name)

        # 2. Extract Text using PyMuPDF (fast and precise)
        print(f"[Worker] Extracting text from {temp_pdf.name}")
        doc = fitz.open(temp_pdf.name)
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
        doc.close()

        # 3. Chunking (1000 tokens, 150 overlap)
        print(f"[Worker] Chunking text (Total chars: {len(full_text)})")
        chunks = chunk_text(full_text, chunk_size=1000, overlap=150)

        print(f"[Worker] Finished! Produced {len(chunks)} chunks.")

        # TODO (dky-012/013): Send chunks to embedding service or Upsert to Upstash Vector directly

    except Exception as e:
        print(f"[Worker ERROR] Failed to process {document_id}: {str(e)}")
    finally:
        # Cleanup temp file
        if os.path.exists(temp_pdf.name):
            os.remove(temp_pdf.name)

@app.get("/api/health")
async def health_check():
    """
    Health check endpoint for Docker / Watchtower monitoring.
    """
    return {"status": "ok"}

@app.post("/api/ingest")
async def ingest_document(payload: IngestPayload, background_tasks: BackgroundTasks):
    """
    Webhook receiver from Supabase pg_net.
    Returns 202 Accepted immediately and processes in the background.
    """
    background_tasks.add_task(process_document, payload.tenant_id, payload.document_id)
    return {"message": "Ingestion task queued", "document_id": payload.document_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
