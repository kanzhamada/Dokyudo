from core.logger import log_event

class TxtExtractionError(Exception):
    pass

def extract_text_from_txt(file_path: str) -> list[str]:
    """
    Read a .txt file into text blocks (one per line).

    Encoding is resolved by trying, in order: UTF-8 with BOM, UTF-16 (BOM),
    plain UTF-8, then cp1252 as a never-failing fallback for legacy Windows
    files. Binary files mislabeled as .txt (NUL bytes) are rejected instead
    of being fed into the embedding pipeline as garbage.
    """
    with open(file_path, "rb") as f:
        raw = f.read()

    # UTF-16 (BOM) legitimately contains NUL bytes — handle it before the
    # binary-content check.
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        decoded = raw.decode("utf-16")
    else:
        if b"\x00" in raw:
            raise TxtExtractionError("File contains NUL bytes; not a valid text file")

        decoded = None
        for enc in ("utf-8-sig", "utf-8", "cp1252"):
            try:
                decoded = raw.decode(enc)
                break
            except (UnicodeDecodeError, UnicodeError):
                continue
        if decoded is None:
            raise TxtExtractionError("Unable to decode text file with any supported encoding")

    blocks = [line.strip() for line in decoded.splitlines()]
    blocks = [b for b in blocks if b]
    log_event("txt_extractor.done", "TXT text extraction complete.", file_path=file_path, blocks=len(blocks))
    return blocks
