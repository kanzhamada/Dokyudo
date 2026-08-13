import fitz
import tiktoken
from core.logger import log_event

def extract_text_from_pdf(file_path: str) -> list[dict]:
    log_event("extractor.start", "Extracting text from PDF.", file_path=file_path)
    doc = fitz.open(file_path)
    pages = []
    for i, page in enumerate(doc):
        pages.append({"page_number": i + 1, "text": page.get_text() + "\n"})
    doc.close()
    return pages

def chunk_text_with_pages(pages: list[dict], chunk_size: int = 1000, overlap: int = 150) -> list[dict]:
    enc = tiktoken.get_encoding("cl100k_base")

    all_tokens = []
    token_to_page = []

    for p in pages:
        tokens = enc.encode(p["text"], allowed_special="all")
        all_tokens.extend(tokens)
        token_to_page.extend([p["page_number"]] * len(tokens))

    chunks = []
    i = 0
    while i < len(all_tokens):
        chunk_tokens = all_tokens[i:i + chunk_size]
        chunk_text = enc.decode(chunk_tokens)

        # Get unique pages for this chunk
        chunk_pages = sorted(list(set(token_to_page[i:i + chunk_size])))

        chunks.append({
            "text": chunk_text,
            "pages": chunk_pages
        })

        i += chunk_size - overlap

    return chunks

def chunk_text_stream(blocks: list[str], chunk_size: int = 1000, overlap: int = 150) -> list[dict]:
    """
    Token-based chunking over a flat text stream. Used for DOCX documents,
    which have no fixed pages; page numbers are attached later by alignment.

    Blocks are joined with a newline token so word boundaries survive into the
    chunk text. Without a separator, "Kunci Soal: D" + "No. Soal: 4" would
    merge into "DNo." and spurious merged tokens would break both the page
    alignment and the embedding quality.

    Each chunk stores its full text plus an "_align_text" core that excludes
    the overlap tokens. The pager aligns on that core so successive chunks do
    not drift (overlap text would otherwise make every advance overshoot).
    """
    enc = tiktoken.get_encoding("cl100k_base")
    newline_token = enc.encode("\n", allowed_special="all")[0]

    all_tokens = []
    for i, block in enumerate(blocks):
        if i > 0:
            all_tokens.append(newline_token)
        all_tokens.extend(enc.encode(block, allowed_special="all"))

    chunks = []
    i = 0
    while i < len(all_tokens):
        chunk_tokens = all_tokens[i:i + chunk_size]
        core_tokens = all_tokens[i + overlap:i + chunk_size]
        chunks.append({
            "text": enc.decode(chunk_tokens),
            "_align_text": enc.decode(core_tokens),
        })
        i += chunk_size - overlap

    return chunks
