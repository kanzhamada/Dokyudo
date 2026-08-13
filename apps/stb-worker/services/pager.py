import fitz
from core.logger import log_event

_NGRAM = 25
_SCAN_STEP = 10
_MAX_OCCURRENCES = 3
_MAX_CANDIDATES = 15


def _normalize_alnum(text: str) -> str:
    return "".join(ch.lower() for ch in text if ch.isalnum())


def _pdf_alnum_stream(pdf_path: str) -> tuple[str, list[int], int]:
    doc = fitz.open(pdf_path)
    try:
        total_pages = len(doc)
        parts = []
        page_per_char = []
        for page_num, page in enumerate(doc, start=1):
            norm = _normalize_alnum(page.get_text())
            parts.append(norm)
            page_per_char.extend([page_num] * len(norm))
        return "".join(parts), page_per_char, total_pages
    finally:
        doc.close()


def _ngram_counts(stream: str) -> dict[str, int]:
    counts = {}
    for i in range(0, len(stream) - _NGRAM + 1):
        gram = stream[i:i + _NGRAM]
        counts[gram] = counts.get(gram, 0) + 1
    return counts


def _rare_ngram_positions(needle: str, start: int, step: int, limit: int, counts: dict[str, int], stream: str) -> list[int]:
    """
    Positions of rare n-grams scanning from `start` (forward or backward via
    step sign), collecting up to `limit` candidates. Semi-frequent fragments
    (e.g. an indikator text reused across two cards) occur early too, so a
    single candidate is unreliable — the caller takes the median.
    """
    positions = []
    i = start
    while i >= 0 and i <= len(needle) - _NGRAM and len(positions) < limit:
        gram = needle[i:i + _NGRAM]
        if counts.get(gram, 0) <= _MAX_OCCURRENCES:
            pos = stream.find(gram)
            if pos != -1:
                positions.append(pos)
        i += step
    return positions


def _quartile(positions: list[int], q: float, default: int) -> int:
    """q=0.25 pulls toward the chunk start, q=0.75 toward the end; both resist
    the few early-duplicate outliers of semi-frequent fragments."""
    if not positions:
        return default
    positions.sort()
    return positions[min(len(positions) - 1, int(len(positions) * q))]


def assign_pages_to_chunks(chunks: list[dict], pdf_path: str) -> list[dict]:
    """
    Attach 1-based PDF page numbers to DOCX-derived chunks.

    Each chunk is pinned by its rare n-grams: 25-character alnum windows that
    appear at most a few times in the PDF text layer. LibreOffice repeats card
    headers/tables on overflow pages, which inflates the PDF stream and breaks
    position-based advances; rare n-grams sidestep that entirely because they
    are unique content (soal text), not boilerplate. The start anchor is the
    first rare n-gram scanning forward, the end anchor the first rare n-gram
    scanning backward; the chunk's pages are the pages those anchors span.
    Chunks without anchors are interpolated between aligned neighbours.
    """
    if not chunks:
        return chunks

    stream, page_per_char, total_pages = _pdf_alnum_stream(pdf_path)
    counts = _ngram_counts(stream)

    raw_texts = [c.get("_align_text") or c["text"] for c in chunks]
    needles = [_normalize_alnum(t) for t in raw_texts]

    aligned = 0
    pending = []
    prev_anchor = -1

    for idx, chunk in enumerate(chunks):
        needle = needles[idx]
        if not needle or len(needle) < _NGRAM:
            chunk["pages"] = []
            pending.append(idx)
            continue

        # Collect candidate positions from both ends; the median resists
        # semi-frequent fragments whose first occurrence lies before the
        # chunk's true position (reused indikator text, repeated option cells).
        scan_len = max(_NGRAM, len(needle) // 2)
        start_cands = _rare_ngram_positions(needle, 0, _SCAN_STEP, _MAX_CANDIDATES, counts, stream)
        end_cands = _rare_ngram_positions(needle, len(needle) - _NGRAM, -_SCAN_STEP, _MAX_CANDIDATES, counts, stream)

        if not start_cands:
            chunk["pages"] = []
            pending.append(idx)
            continue

        start_pos = _quartile(start_cands, 0.25, 0)
        end_pos = _quartile(end_cands, 0.75, start_pos)

        if end_pos < start_pos:
            end_pos = start_pos

        # Guard against a start anchor that jumped backwards across chunks.
        if prev_anchor != -1 and start_pos < prev_anchor:
            start_pos = prev_anchor
            if end_pos < start_pos:
                end_pos = start_pos

        pages = sorted(set(page_per_char[start_pos:end_pos + _NGRAM]))
        pages = [p for p in pages if 1 <= p <= total_pages]
        chunk["pages"] = pages or [page_per_char[start_pos]]
        aligned += 1
        prev_anchor = start_pos

        for pend_idx in pending:
            chunks[pend_idx]["pages"] = [chunks[pend_idx - 1]["pages"][-1]] if pend_idx > 0 and chunks[pend_idx - 1]["pages"] else [1]
        pending = []

    if pending:
        prev = chunks[pending[0] - 1]["pages"][-1] if pending[0] > 0 and chunks[pending[0] - 1]["pages"] else 1
        for pend_idx in pending:
            chunks[pend_idx]["pages"] = [prev]

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
        stream_chars=len(stream),
    )
    return chunks
