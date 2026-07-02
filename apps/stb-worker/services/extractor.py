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
    # Simplified recursive splitter
    separators = ["\n\n", "\n", ". ", " ", ""]
    
    def split_text(txt, size):
        if len(txt) <= size:
            return [txt]
            
        for sep in separators:
            if sep == "":
                # Fallback to character splitting
                return [txt[i:i+size] for i in range(0, len(txt), size)]
                
            splits = txt.split(sep)
            if len(splits) > 1:
                chunks = []
                current_chunk = ""
                
                for s in splits:
                    if len(current_chunk) + len(s) + len(sep) > size and current_chunk:
                        chunks.append(current_chunk)
                        current_chunk = s + sep
                    else:
                        current_chunk += s + sep
                        
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    
                # If splitting by this separator successfully created smaller chunks, return them
                final_chunks = []
                for c in chunks:
                    if len(c) > size:
                        final_chunks.extend(split_text(c, size))
                    else:
                        final_chunks.append(c)
                return final_chunks
                
        return [txt]

    chunks = split_text(text, chunk_size)
    
    # Add overlap
    overlapped_chunks = []
    for i in range(len(chunks)):
        if i == 0:
            overlapped_chunks.append(chunks[i])
        else:
            # Prepend overlap from previous chunk
            prev = chunks[i-1]
            overlap_str = prev[-overlap:] if len(prev) > overlap else prev
            overlapped_chunks.append(overlap_str + chunks[i])
            
    return overlapped_chunks

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
