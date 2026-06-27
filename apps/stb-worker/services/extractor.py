import fitz
import tiktoken

def extract_text_from_pdf(file_path: str) -> str:
    print(f"[Extractor] Extracting text from {file_path}")
    doc = fitz.open(file_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"
    doc.close()
    return full_text

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150) -> list[str]:
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    chunks = []
    i = 0
    while i < len(tokens):
        chunk_tokens = tokens[i:i + chunk_size]
        chunks.append(enc.decode(chunk_tokens))
        i += chunk_size - overlap
    return chunks
