import html as html_lib
import re
import markdown
from core.logger import log_event
from services.txt_extractor import decode_text_bytes, TxtExtractionError

# Minimal styling so the rendered PDF looks like a document, not a raw dump.
_CSS = """
body { font-family: 'Liberation Serif', serif; margin: 2cm; font-size: 11pt; color: #1a1a1a; }
h1 { font-size: 20pt; margin-top: 0.8em; }
h2 { font-size: 15pt; margin-top: 0.7em; }
h3 { font-size: 12pt; }
p { margin: 0.4em 0; }
table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
th, td { border: 1px solid #999; padding: 4pt; text-align: left; }
th { background: #f0f0f0; }
code { font-family: 'Liberation Mono', monospace; background: #f2f2f2; padding: 0 2pt; }
pre { background: #f5f5f5; border: 1px solid #ddd; padding: 8pt; white-space: pre-wrap; }
blockquote { border-left: 3px solid #bbb; margin: 0.5em 0; padding-left: 12pt; color: #444; }
ul, ol { margin: 0.4em 0; }
img { max-width: 100%; }
"""

def render_markdown_to_html(md_path: str, out_html_path: str):
    """
    Render a markdown file to a styled, standalone HTML document that
    LibreOffice can convert to PDF (soffice renders .md itself as plain
    text, so HTML is the reliable intermediate).
    """
    with open(md_path, "rb") as f:
        raw = f.read()
    text = decode_text_bytes(raw)

    body = markdown.markdown(text, extensions=["tables", "fenced_code"])
    html = (
        "<!DOCTYPE html>\n"
        "<html><head><meta charset=\"utf-8\"><style>\n"
        f"{_CSS}\n"
        "</style></head><body>\n"
        f"{body}\n"
        "</body></html>\n"
    )
    with open(out_html_path, "w", encoding="utf-8") as f:
        f.write(html)

    log_event("markdown_extractor.rendered", "Markdown rendered to HTML.", file_path=md_path, out_path=out_html_path)

_TAG_RE = re.compile(r"<[^>]+>")
_SKIP_BLOCKS_RE = re.compile(r"<(style|script|head)[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)

def extract_text_from_markdown_html(html_path: str) -> list[str]:
    """
    Extract clean text blocks from the rendered HTML (tags stripped, entities
    unescaped). Used for chunking — the source markdown is never chunked raw,
    so syntax noise (#, **, backticks) does not pollute the embeddings.
    """
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Drop style/script/head blocks first so CSS like "color: #1a1a1a"
    # cannot leak into the chunk text.
    html = _SKIP_BLOCKS_RE.sub(" ", html)
    text = _TAG_RE.sub("", html)
    text = html_lib.unescape(text)
    blocks = [line.strip() for line in text.splitlines()]
    blocks = [b for b in blocks if b]
    log_event("markdown_extractor.done", "Markdown text extraction complete.", file_path=html_path, blocks=len(blocks))
    return blocks
