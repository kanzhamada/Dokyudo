from fastapi.testclient import TestClient
from main import app, rehydrate_ingestion_queue
from core.config import settings
from services.queue import ingestion_queue

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "queue_depth" in body


def test_ingest_document_requires_secret():
    # FastAPI rejects a missing required header at validation time (422).
    payload = {
        "document_id": "test-doc-123",
        "tenant_id": "test-tenant-456",
    }
    response = client.post("/api/ingest", json=payload)
    assert response.status_code == 422


def test_ingest_document():
    # Note: this will trigger a background task, but in TestClient it runs in the background silently.
    # We just want to assert the endpoint returns 200 OK properly structured.
    payload = {
        "document_id": "test-doc-123",
        "tenant_id": "test-tenant-456",
    }
    response = client.post(
        "/api/ingest",
        json=payload,
        headers={"X-Worker-Secret": settings.WORKER_SECRET},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Ingestion task queued"
    assert body["document_id"] == "test-doc-123"
    assert "queue_depth" in body


def test_fetch_documents_needing_ingestion_query(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return [{"id": "doc-1", "tenant_id": "tenant-1"}]

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, headers=None):
            assert "status=eq.confirmed" in url
            assert "select=id,tenant_id" in url
            return FakeResponse()

    monkeypatch.setattr("services.database.httpx.Client", lambda: FakeClient())

    from services.database import fetch_documents_needing_ingestion

    assert fetch_documents_needing_ingestion() == [
        {"id": "doc-1", "tenant_id": "tenant-1"},
    ]


def test_rehydrate_ingestion_queue_enqueues_pending_docs(monkeypatch):
    monkeypatch.setattr(
        "services.database.fetch_documents_needing_ingestion",
        lambda: [
            {"id": "doc-1", "tenant_id": "tenant-1"},
            {"id": "doc-2", "tenant_id": "tenant-2"},
        ],
    )
    depth_before = ingestion_queue.depth
    rehydrate_ingestion_queue()
    assert ingestion_queue.depth == depth_before + 2


def test_rehydrate_ingestion_queue_failure_is_non_fatal(monkeypatch):
    def boom():
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(
        "services.database.fetch_documents_needing_ingestion",
        boom,
    )
    depth_before = ingestion_queue.depth
    # Must not raise — startup survives a broken re-hydration.
    rehydrate_ingestion_queue()
    assert ingestion_queue.depth == depth_before
