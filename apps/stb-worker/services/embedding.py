import time
import httpx
from core.config import settings
from core.logger import dev_print

def generate_embedding_with_retry(text: str, max_retries: int = 5) -> list[float]:
    """
    Generates a 768-dim vector using Gemini REST API with automatic exponential backoff on 429 Rate Limits.
    """
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not set in environment")
        
    model_name = settings.GEMINI_EMBEDDING_MODEL
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:embedContent"
    
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.GOOGLE_API_KEY
    }
    
    payload = {
        "content": {
            "parts": [{"text": text}]
        },
        "output_dimensionality": 768
    }
    
    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, headers=headers, json=payload)
                
            if res.status_code in [429, 500, 502, 503, 504]:
                wait_ms = (2 ** attempt) * 5
                dev_print(f"[Embedding] API Error ({res.status_code}). Sleeping for {wait_ms}s before retry...")
                time.sleep(wait_ms)
                continue
                
            res.raise_for_status()
            data = res.json()
            return data["embedding"]["values"]
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code in [429, 500, 502, 503, 504]:
                wait_ms = (2 ** attempt) * 5
                dev_print(f"[Embedding] API Error ({e.response.status_code}). Sleeping for {wait_ms}s before retry...")
                time.sleep(wait_ms)
            else:
                raise Exception(f"Gemini API Error: {e.response.text}")
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "rate limit" in err_str:
                wait_ms = (2 ** attempt) * 5
                dev_print(f"[Embedding] API Exception Rate Limit. Sleeping for {wait_ms}s...")
                time.sleep(wait_ms)
            else:
                raise Exception(f"Gemini API Exception: {str(e)}")
            
    raise Exception("Max retries exceeded for Gemini API Embedding Generation")
