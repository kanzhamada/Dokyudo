"""
In-process FIFO job queue for sequential document processing.

Uses a single dedicated worker thread to ensure only one document
is being embedded at a time, preventing parallel Gemini API calls
from competing for the same RPM/TPM quota.

Supports cancellation: jobs can be removed from the queue or,
if currently processing, signalled to abort via a shared set.
"""
import queue
import threading
from dataclasses import dataclass
from core.logger import log_event


@dataclass
class IngestionJob:
    """Represents a single document ingestion task."""
    tenant_id: str
    document_id: str


class IngestionQueue:
    """Thread-safe FIFO queue with a single background consumer and cancellation support."""

    def __init__(self):
        self._queue: queue.Queue[IngestionJob | None] = queue.Queue()
        self._worker_thread: threading.Thread | None = None
        self._running = False

        # Cancellation state
        self._cancelled_ids: set[str] = set()
        self._cancelled_lock = threading.Lock()
        self._active_document_id: str | None = None

    def start(self):
        """Start the background worker thread. Call once at app startup."""
        if self._running:
            return
        self._running = True
        self._worker_thread = threading.Thread(
            target=self._consumer_loop,
            name="ingestion-worker",
            daemon=True,
        )
        self._worker_thread.start()
        log_event("queue.worker_started", "Ingestion worker thread started.")

    def stop(self):
        """Signal the worker to stop and wait for it to drain. Call at app shutdown."""
        if not self._running:
            return
        self._running = False
        # Send poison pill to unblock .get()
        self._queue.put(None)
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=300)
        log_event("queue.worker_stopped", "Ingestion worker thread stopped.")

    def enqueue(self, job: IngestionJob):
        """Add a job to the queue. Returns immediately (non-blocking)."""
        self._queue.put(job)
        depth = self._queue.qsize()
        log_event("queue.job_enqueued", "Job successfully added to queue", document_id=job.document_id, tenant_id=job.tenant_id, queue_depth=depth)

    @property
    def depth(self) -> int:
        return self._queue.qsize()

    def cancel(self, document_id: str) -> dict:
        """
        Cancel a document's ingestion job.

        If the job is still in the queue (pending), it will be skipped when dequeued.
        If the job is currently being processed (active), it will be signalled to abort
        at the next chunk boundary via is_cancelled().

        Returns a dict with the cancellation status.
        """
        with self._cancelled_lock:
            self._cancelled_ids.add(document_id)

        is_active = self._active_document_id == document_id

        status = "cancelled_active" if is_active else "cancelled_pending"
        log_event("queue.job_cancelled", "Cancellation requested for document", document_id=document_id, status=status)

        return {
            "document_id": document_id,
            "status": status,
            "message": (
                "Job is currently processing — will abort at next chunk boundary"
                if is_active
                else "Job marked for cancellation — will be skipped when dequeued"
            ),
        }

    def is_cancelled(self, document_id: str) -> bool:
        """
        Check if a document_id has been cancelled.
        Called by the processor at each chunk iteration to allow early exit.
        """
        with self._cancelled_lock:
            return document_id in self._cancelled_ids

    def _clear_cancelled(self, document_id: str):
        """Remove a document_id from the cancelled set after it has been handled."""
        with self._cancelled_lock:
            self._cancelled_ids.discard(document_id)

    def _consumer_loop(self):
        """Main loop: pull jobs one at a time and process sequentially."""
        # Import here to avoid circular imports at module level
        from services.processor import process_document

        while self._running:
            try:
                job = self._queue.get(timeout=5.0)
            except queue.Empty:
                continue

            # Poison pill — shutdown signal
            if job is None:
                self._queue.task_done()
                break

            # Skip if cancelled while waiting in queue
            if self.is_cancelled(job.document_id):
                log_event("queue.job_skipped", "Skipping cancelled job in queue", document_id=job.document_id)
                self._clear_cancelled(job.document_id)
                self._queue.task_done()
                continue

            try:
                self._active_document_id = job.document_id
                log_event("queue.job_processing", "Started processing document from queue", document_id=job.document_id, tenant_id=job.tenant_id, remaining_depth=self._queue.qsize())
                process_document(job.tenant_id, job.document_id)
            except Exception as exc:
                log_event("queue.worker_error", "Unhandled error in consumer loop", level="ERROR", document_id=job.document_id, error=str(exc))
            finally:
                self._active_document_id = None
                self._clear_cancelled(job.document_id)
                self._queue.task_done()

        log_event("queue.consumer_exited", "Queue consumer loop exited.")


# Module-level singleton
ingestion_queue = IngestionQueue()
