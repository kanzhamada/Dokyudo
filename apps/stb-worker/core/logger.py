import sys
import json
import logging
import re
from datetime import datetime
from core.config import settings

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "message": record.getMessage(),
        }
        
        if hasattr(record, "context") and isinstance(record.context, dict):
            log_obj.update(record.context)
            
        return json.dumps(log_obj)

logger = logging.getLogger("stb-worker")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

def dev_print(*args, **kwargs):
    """
    Structured JSON Logging wrapper.
    Converts unstructured print statements into observable JSON logs
    by auto-extracting UUIDs and categorizing event types.
    """
    if settings.NODE_ENV != 'dev' and kwargs.get("skip_prod", False):
        return
        
    msg = " ".join(str(a) for a in args)
    context = {}
    
    # Auto-extract UUIDs for distributed tracing (document_id, tenant_id)
    uuids = re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', msg, re.IGNORECASE)
    if len(uuids) > 0:
        context["document_id"] = uuids[0]
    if len(uuids) > 1:
        context["tenant_id"] = uuids[1]
        
    # Categorize event types based on prefix
    if "[Queue]" in msg:
        context["event"] = "queue_event"
    elif "[Processor]" in msg:
        context["event"] = "processing_event"
    elif "[GATEKEEPER" in msg:
        context["event"] = "gatekeeper_event"
    elif "[LLM]" in msg:
        context["event"] = "llm_event"
    elif "[Storage]" in msg:
        context["event"] = "storage_event"
    elif "[Extractor]" in msg:
        context["event"] = "extractor_event"
    elif "[SECURITY" in msg:
        context["event"] = "security_event"
    else:
        context["event"] = "general_event"
        
    # Route to correct severity level
    if "ERROR" in msg or "EXHAUSTED" in msg or "Failed" in msg:
        logger.error(msg, extra={"context": context})
    elif "WARNING" in msg:
        logger.warning(msg, extra={"context": context})
    else:
        logger.info(msg, extra={"context": context})
