import fitz
from core.logger import log_event

# Normalization: keep only letters and digits. This makes the PDF glyph layer
# ("x2+ y2=r2" from a rendered formula) and the DOCX linear form ("x^2+y^2=r^2")
# converge to the same stream ("x2y2r2"), which is what makes alignment work.
def _normalize_alnum(text: str) -> str:
    return "".join(ch.lower() for ch in text if ch.isalnum())

def _pdf_alnum_stream(pdf_path: str) -> tuple[str, list[int], int]:
    """
    Returns (normalized_stream, page_per_char, total_pages) for the converted
    PDF. Formula glyphs are normalized away implicitly (operators and spacing
    are dropped), so prose anchors dominate the matching.
    """
    doc = fitz.open(pdf_path)
    try:
        total_pages = len(doc)
        stream_parts = []
        page_per_char = []
        for page_num, page in enumerate(doc, start=1):
            norm = _normalize_alnum(page.get_text())
            stream_parts.append(norm)
            page_per_char.extend([page_num] * len(norm))
        return "".join(stream_parts), page_per_char, total_pages
    finally:
        doc.close()

_PREFIX_WINDOWS = (160, 80, 40, 20)

def _find_window(needle: str, haystack: str, start: int, end: int) -> tuple[int, int] | None:
    """
    Greedy forward search bounded to [start, end) with progressive prefix
    shortening. The bound keeps matches inside the chunk's expected footprint
    so repeated boilerplate on later pages cannot hijack the alignment.
    Returns (pos, advance); a prefix match consumes the chunk's full text, a
    tail match consumes only the matched tail window.
    """
    if len(needle) >= min(_PREFIX_WINDOWS):
        for n in _PREFIX_WINDOWS:
            pos = haystack.find(needle[:n], start, end)
            if pos != -1:
                return pos, pos + len(needle)
        # Fall back to the tail of the chunk — the head may be a formula whose
        # PDF rendering order differs from the linear form.
        for n in _PREFIX_WINDOWS:
            tail = needle[-n:]
            if len(tail) < n:
                continue
            pos = haystack.find(tail, start, end)
            if pos != -1:
                return pos, pos + n
        return None
    if len(needle) >= 6:
        pos = haystack.find(needle, start, end)
        if pos != -1:
            return pos, pos + len(needle)
    return None

def assign_pages_to_chunks(chunks: list[dict], pdf_path: str) -> list[dict]:
    """
    Attach 1-based PDF page numbers to DOCX-derived chunks by aligning chunk
    text against the text layer of the converted PDF. The PDF layout renders
    formulas as glyphs while the chunks carry linear math, so matching uses
    alnum-normalized streams and short prefix windows. Chunks that cannot be
    aligned are interpolated between their aligned neighbours.
    """
    if not chunks:
        return chunks

    stream, page_per_char, total_pages = _pdf_alnum_stream(pdf_path)

    aligned = 0
    search_start = 0
    pending = []  # (index) chunks waiting for interpolation

    for idx, chunk in enumerate(chunks):
        # Align on the chunk's unique core (overlap tokens excluded) so
        # advances never overshoot into the next chunk's head.
        needle = _normalize_alnum(chunk.get("_align_text") or chunk["text"])
        if not needle:
            chunk["pages"] = []
            pending.append(idx)
            continue

        # Bound the search to the chunk's expected footprint so repeated
        # boilerplate on later pages cannot pull the match forward.
        search_end = min(len(stream), search_start + len(needle) + 400)

        match = _find_window(needle, stream, search_start, search_end)
        if match is None:
            chunk["pages"] = []
            pending.append(idx)
            continue

        pos, advance = match
        search_start = advance

        # Tighten the span: locate the chunk's tail near its expected end
        # position instead of assuming the whole needle length is contiguous.
        end = advance
        if len(needle) >= 80:
            expected_end = pos + len(needle)
            tail = needle[-80:]
            tail_lo = max(pos, expected_end - 240)
            tail_hi = min(len(stream), expected_end + 240)
            tail_pos = stream.find(tail, tail_lo, tail_hi)
            if tail_pos != -1:
                end = tail_pos + 80

        pages = sorted(set(page_per_char[pos:end]))
        pages = [p for p in pages if 1 <= p <= total_pages]
        chunk["pages"] = pages or [page_per_char[pos]]
        aligned += 1

        for pend_idx in pending:
            chunks[pend_idx]["pages"] = [chunks[pend_idx - 1]["pages"][-1]] if pend_idx > 0 and chunks[pend_idx - 1]["pages"] else [1]
        pending = []

    # Interpolate any trailing unaligned chunks.
    if pending:
        prev = chunks[pending[0] - 1]["pages"][-1] if pending[0] > 0 and chunks[pending[0] - 1]["pages"] else 1
        for pend_idx in pending:
            chunks[pend_idx]["pages"] = [prev]

    # Enforce monotonic non-decreasing pages so citation jumps never go backwards.
    floor = 1
    for chunk in chunks:
        pages = [p for p in chunk["pages"] if p >= floor]
        if not pages:
            pages = [floor]
        chunk["pages"] = [min(p, total_pages) for p in sorted(set(pages))]
        floor = chunk["pages"][-1]

    log_event(
        "pager.alignment_done",
        "Chunk-to-page alignment complete.",
        chunks=len(chunks),
        aligned=aligned,
        interpolated=len(chunks) - aligned,
        pdf_pages=total_pages,
    )
    return chunks
