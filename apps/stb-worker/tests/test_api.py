from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "stb-worker"}

def test_ingest_document():
    # Note: this will trigger a background task, but in TestClient it runs in the background silently.
    # We just want to assert the endpoint returns 200 OK properly structured.
    payload = {
        "document_id": "test-doc-123",
        "tenant_id": "test-tenant-456"
    }
    response = client.post("/api/ingest", json=payload)
    assert response.status_code == 200
    assert response.json() == {
        "message": "Ingestion task queued",
        "document_id": "test-doc-123"
    }
