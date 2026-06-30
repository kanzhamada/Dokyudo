import httpx
from core.config import settings
from core.logger import dev_print

def generate_llm_description(text: str) -> str:
    """
    Generates a concise document description using Google Gemini API.
    """
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not set in environment")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={settings.GOOGLE_API_KEY}"

    prompt = f"""You are an expert document summarizer.
Your task is to write a comprehensive paragraph summarizing the core subject, purpose, and key entities of this document based on its introductory text.

STRICT INSTRUCTIONS:
1. You MUST write exactly 2 to 3 complete and descriptive sentences.
2. The summary MUST contain at least 20 words. Do NOT output a single word, title, or fragmented sentence.
3. Be direct. Do not start with "This document discusses..." or "This is a document about...".
4. Language MUST MATCH the dominant language of the text.

Introductory Document Text:
---
{text}
---
"""

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.5,
            "maxOutputTokens": 256
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }

    dev_print("[LLM] Generating document description...")

    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.post(url, json=payload)
            res.raise_for_status()
            data = res.json()

            if "candidates" in data and len(data["candidates"]) > 0:
                candidate = data["candidates"][0]
                if "parts" in candidate["content"]:
                    description = candidate["content"]["parts"][0]["text"].strip()
                    dev_print(f"[LLM] Description generated: {description}")
                    return description
                else:
                    dev_print(f"[LLM ERROR] Blocked by safety or finishReason: {candidate.get('finishReason')}")
                    return ""
            else:
                dev_print("[LLM ERROR] No candidates returned from Gemini.")
                return ""
    except Exception as e:
        dev_print(f"[LLM ERROR] Failed to generate description: {str(e)}")
        return ""
