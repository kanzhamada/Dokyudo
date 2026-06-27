from fastapi import FastAPI
from api.ingest import router as ingest_router

app = FastAPI(title="Dokyudo STB Worker")

@app.get("/api/health")
async def health_check():
    """
    Health check endpoint for Docker / Watchtower monitoring.
    """
    return {"status": "ok"}

app.include_router(ingest_router, prefix="/api", tags=["Ingestion"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
