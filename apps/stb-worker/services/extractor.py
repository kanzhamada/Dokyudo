import fitz
import re
from core.logger import dev_print

def extract_text_from_pdf(file_path: str) -> list[dict]:
    dev_print(f"[Extractor] Extracting text from {file_path}")
    doc = fitz.open(file_path)
    pages = []
    for i, page in enumerate(doc):
        pages.append({"page_number": i + 1, "text": page.get_text() + "\n"})
    doc.close()
    return pages

def recursive_text_split(text: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Splits text into chunks of approximately `chunk_size` characters.
    Uses a priority list of separators, falling back to hard character splits.
    Overlap is applied between consecutive chunks afterward.
    """
    separators = ["\n\n", "\n", ". ", " "]

    def _split_once(txt: str, size: int) -> list[str]:
        """Split txt into pieces <= size using the best available separator."""
        if len(txt) <= size:
            return [txt]

        for sep in separators:
            parts = txt.split(sep)
            if len(parts) <= 1:
                continue

            # Greedily merge parts into chunks that fit within size
            chunks = []
            current = parts[0]

            for j in range(1, len(parts)):
                candidate = current + sep + parts[j]
                if len(candidate) <= size:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)
                    current = parts[j]

            if current:
                chunks.append(current)

            # Check if we actually made progress (at least 2 pieces)
            if len(chunks) > 1 or (len(chunks) == 1 and len(chunks[0]) <= size):
                return chunks

        # Fallback: hard character split (guaranteed to terminate)
        return [txt[i:i + size] for i in range(0, len(txt), size)]

    # Iterative loop: keep splitting until every piece fits
    pieces = [text]
    max_iterations = 200  # Safety cap for STB memory
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        all_fit = True
        next_pieces = []

        for piece in pieces:
            if len(piece) <= chunk_size:
                next_pieces.append(piece)
            else:
                all_fit = False
                next_pieces.extend(_split_once(piece, chunk_size))

        pieces = next_pieces
        if all_fit:
            break

    # Apply overlap between consecutive chunks
    if overlap <= 0 or len(pieces) <= 1:
        return pieces

    overlapped = [pieces[0]]
    for i in range(1, len(pieces)):
        prev = pieces[i - 1]
        overlap_str = prev[-overlap:] if len(prev) > overlap else prev
        overlapped.append(overlap_str + pieces[i])

    return overlapped

def chunk_text_with_pages(pages: list[dict], parent_size: int = 2000, child_size: int = 400, overlap: int = 150) -> list[dict]:
    """
    Returns Parent chunks, each containing multiple Child chunks.
    Maintains approximate page mapping.
    """
    
    # Track page boundaries roughly by character index
    full_text = ""
    page_boundaries = []
    
    for p in pages:
        start_idx = len(full_text)
        full_text += p["text"]
        end_idx = len(full_text)
        page_boundaries.append({
            "page": p["page_number"],
            "start": start_idx,
            "end": end_idx
        })
        
    parent_texts = recursive_text_split(full_text, parent_size, overlap)
    
    results = []
    current_search_idx = 0
    
    for p_text in parent_texts:
        # Find which pages this parent chunk belongs to
        p_pages = set()
        
        # Simple substring search to find position
        found_idx = full_text.find(p_text[:50], current_search_idx)
        if found_idx != -1:
            chunk_start = found_idx
            chunk_end = found_idx + len(p_text)
            current_search_idx = chunk_end - overlap
            
            for pb in page_boundaries:
                if (chunk_start < pb["end"] and chunk_end > pb["start"]):
                    p_pages.add(pb["page"])
        
        if not p_pages:
            p_pages.add(1) # fallback
            
        child_texts = recursive_text_split(p_text, child_size, overlap // 2)
        
        results.append({
            "text": p_text,
            "pages": sorted(list(p_pages)),
            "children": [{"text": c_text} for c_text in child_texts]
        })
        
    return results
