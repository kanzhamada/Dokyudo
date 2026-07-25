import time
import random
import httpx
from core.config import settings
from core.logger import log_event

class TransientAPIError(Exception):
    """Raised when an external API call fails after all retry attempts due to transient errors."""
    pass

def generate_embedding_with_retry(texts: list[str], max_retries: int = 5) -> list[list[float]]:
    """
    Generates 1024-dim vectors for a batch of texts using Cloudflare Workers AI with automatic exponential backoff.
    Retries on 401, 403, 408, 429, 500, 502, 503, 504 and network/timeout exceptions.
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
    
    RETRYABLE_STATUS_CODES = {401, 403, 408, 429, 500, 502, 503, 504}
    
    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(url, headers=headers, json=payload)
                
            if res.status_code in RETRYABLE_STATUS_CODES:
                wait_sec = min(60, (2 ** attempt) * 2) + random.uniform(0.5, 1.5)
                log_event(
                    "embedding.api_error",
                    f"Transient API Error ({res.status_code}) from Cloudflare embedding provider, retrying.",
                    level="WARNING",
                    status_code=res.status_code,
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    wait_seconds=round(wait_sec, 2),
                    response_text=res.text[:200]
                )
                time.sleep(wait_sec)
                continue
                
            res.raise_for_status()
            data = res.json()
            
            if not data.get("success"):
                raise Exception(f"Cloudflare API returned failure: {data.get('errors')}")
            
            return data["result"]["data"]
            
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code if e.response else 0
            if status_code in RETRYABLE_STATUS_CODES:
                wait_sec = min(60, (2 ** attempt) * 2) + random.uniform(0.5, 1.5)
                log_event(
                    "embedding.api_error",
                    f"HTTPStatusError ({status_code}) from Cloudflare embedding provider, retrying.",
                    level="WARNING",
                    status_code=status_code,
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    wait_seconds=round(wait_sec, 2)
                )
                time.sleep(wait_sec)
            else:
                raise Exception(f"Cloudflare API Fatal Error ({status_code}): {e.response.text if e.response else str(e)}")
                
        except (httpx.RequestError, httpx.TimeoutException) as e:
            wait_sec = min(60, (2 ** attempt) * 2) + random.uniform(0.5, 1.5)
            log_event(
                "embedding.network_error",
                f"Network/Timeout error during embedding generation, retrying.",
                level="WARNING",
                error=str(e),
                attempt=attempt + 1,
                max_retries=max_retries,
                wait_seconds=round(wait_sec, 2)
            )
            time.sleep(wait_sec)
            
        except Exception as e:
            err_str = str(e).lower()
            if any(k in err_str for k in ["429", "401", "403", "quota", "rate limit", "unauthorized"]):
                wait_sec = min(60, (2 ** attempt) * 2) + random.uniform(0.5, 1.5)
                log_event(
                    "embedding.transient_exception",
                    "Transient Exception hit, retrying.",
                    level="WARNING",
                    error=str(e),
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    wait_seconds=round(wait_sec, 2)
                )
                time.sleep(wait_sec)
            else:
                raise Exception(f"Cloudflare API Exception: {str(e)}")
            
    raise TransientAPIError(f"Cloudflare API Embedding Generation failed after {max_retries} retry attempts.")
