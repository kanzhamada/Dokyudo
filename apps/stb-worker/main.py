from contextlib import asynccontextmanager
from fastapi import FastAPI
from api.ingest import router as ingest_router
from services.queue import ingestion_queue, IngestionJob
from core.logger import log_event


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: start the ingestion worker thread and
    re-hydrate the queue with documents left unprocessed by a previous run."""
    ingestion_queue.start()
    rehydrate_ingestion_queue()
    yield
    ingestion_queue.stop()


def rehydrate_ingestion_queue():
    """
    Re-enqueue documents that are 'confirmed' (the pg_net webhook already fired)
    but never reached 'processed' — e.g. the worker restarted while jobs were
    still sitting in the in-memory queue. Without this, those documents would
    stay stuck in 'confirmed' forever. The processor's idempotency check makes
    duplicates harmless. Best-effort: a failure is logged, never fatal.
    """
    try:
        from services.database import fetch_documents_needing_ingestion

        docs = fetch_documents_needing_ingestion()
        for doc in docs:
            ingestion_queue.enqueue(IngestionJob(
                tenant_id=doc["tenant_id"],
                document_id=doc["id"],
            ))
        if docs:
            log_event(
                "queue.rehydrated",
                f"Re-enqueued {len(docs)} unprocessed documents after restart.",
            )
    except Exception as exc:
        log_event(
            "queue.rehydrate_failed",
            f"Queue re-hydration failed: {exc}",
            level="ERROR",
        )


app = FastAPI(title="Dokyudo STB Worker", lifespan=lifespan)

@app.get("/api/health")
async def health_check():
    """
    Health check endpoint for Docker / Watchtower monitoring.
    """
    return {
        "status": "ok",
        "queue_depth": ingestion_queue.depth,
    }

app.include_router(ingest_router, prefix="/api", tags=["Ingestion"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
