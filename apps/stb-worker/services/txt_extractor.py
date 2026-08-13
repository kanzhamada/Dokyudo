from core.logger import log_event

class TxtExtractionError(Exception):
    pass

def decode_text_bytes(raw: bytes) -> str:
    """
    Decode raw text bytes with a pragmatic encoding chain: UTF-16 (BOM) first
    (it legitimately contains NUL bytes), then UTF-8 with BOM, plain UTF-8,
    and finally cp1252 (Windows Latin-1) which never fails for legacy text.
    Binary content (NUL bytes) is rejected.
    """
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16")

    if b"\x00" in raw:
        raise TxtExtractionError("File contains NUL bytes; not a valid text file")

    for enc in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise TxtExtractionError("Unable to decode text file with any supported encoding")

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

    decoded = decode_text_bytes(raw)

    blocks = [line.strip() for line in decoded.splitlines()]
    blocks = [b for b in blocks if b]
    log_event("txt_extractor.done", "TXT text extraction complete.", file_path=file_path, blocks=len(blocks))
    return blocks
