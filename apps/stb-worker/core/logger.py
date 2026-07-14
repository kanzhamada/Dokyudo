import sys
import json
from datetime import datetime
from core.config import settings

def log_event(event: str, message: str, level: str = "INFO", **kwargs):
    """
    Structured Wide Event Logger.
    Emits a single JSON log line (or pretty JSON in dev) per event.
    """
    if settings.NODE_ENV != 'dev' and kwargs.get("skip_prod", False):
        return
        
    log_obj = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": level.upper(),
        "event": event,
        "message": message,
    }
    
    metadata = { k: v for k, v in kwargs.items() if k != "skip_prod" }
    if metadata:
        log_obj["metadata"] = metadata
    
    is_dev = settings.NODE_ENV == 'dev'
    if is_dev:
        print(json.dumps(log_obj, indent=2))
    else:
        print(json.dumps(log_obj))
        
    sys.stdout.flush()
