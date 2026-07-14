import time
import httpx
from core.config import settings
from core.logger import log_event

def generate_embedding_with_retry(texts: list[str], max_retries: int = 5) -> list[list[float]]:
    """
    Generates 1024-dim vectors for a batch of texts using Cloudflare Workers AI with automatic exponential backoff.
    """
    if not settings.CLOUDFLARE_ACCOUNT_ID or not settings.CLOUDFLARE_AUTH_TOKEN:
        raise ValueError("Cloudflare credentials are not set in environment")
        
    model_name = settings.CF_EMBEDDING_MODEL
    url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/ai/run/{model_name}"
    
    headers = {
        "Authorization": f"Bearer {settings.CLOUDFLARE_AUTH_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "text": texts
    }
    
    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(url, headers=headers, json=payload)
                
            if res.status_code in [429, 500, 502, 503, 504]:
                wait_ms = (2 ** attempt) * 5
                log_event("embedding.api_error", "API Error from embedding provider, retrying.", level="WARNING", status_code=res.status_code, wait_seconds=wait_ms/1000)
                time.sleep(wait_ms)
                continue
                
            res.raise_for_status()
            data = res.json()
            
            if not data.get("success"):
                raise Exception(f"Cloudflare API returned failure: {data.get('errors')}")
            
            return data["result"]["data"]
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code in [429, 500, 502, 503, 504]:
                wait_ms = (2 ** attempt) * 5
                log_event("embedding.api_error", "API Error from embedding provider, retrying.", level="WARNING", status_code=e.response.status_code, wait_seconds=wait_ms/1000)
                time.sleep(wait_ms)
            else:
                raise Exception(f"Cloudflare API Error: {e.response.text}")
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "rate limit" in err_str:
                wait_ms = (2 ** attempt) * 5
                log_event("embedding.rate_limit", "Rate limit exceeded, retrying.", level="WARNING", wait_seconds=wait_ms/1000)
                time.sleep(wait_ms)
            else:
                raise Exception(f"Cloudflare API Exception: {str(e)}")
            
    raise Exception("Max retries exceeded for Cloudflare API Embedding Generation")
