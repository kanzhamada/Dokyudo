from contextlib import asynccontextmanager
from fastapi import FastAPI
from api.ingest import router as ingest_router
from services.queue import ingestion_queue


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle: start/stop the ingestion worker thread."""
    ingestion_queue.start()
    yield
    ingestion_queue.stop()


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
