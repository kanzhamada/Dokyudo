import httpx
from core.config import settings
from core.logger import dev_print

def generate_llm_description(text: str) -> str:
    """
    Generates a concise document description using Google Gemini API.
    """
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not set in environment")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GOOGLE_API_KEY}"

    prompt = f"""You are a professional document archiving assistant.
Your task is to write a comprehensive but brief summary of this document based on its introductory text.

Strict rules:
1. You MUST write exactly 1 or 2 complete sentences. Do not just output a single word or title.
2. Maximum 150 characters.
3. Get straight to the point, do not use introductory phrases like "This document discusses...".
4. Match the language of the description with the dominant language of the document. If the document is in English, write in English. If it is in Indonesian, write in Indonesian.

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
            "temperature": 0.3,
            "maxOutputTokens": 150
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
