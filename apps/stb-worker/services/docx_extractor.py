import docx
from core.logger import log_event

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"

def _w(tag: str) -> str:
    return f"{{{W_NS}}}{tag}"

def _m(tag: str) -> str:
    return f"{{{M_NS}}}{tag}"

# Constructs whose content is passed through verbatim (containers / text runs).
_PASSTHROUGH_TAGS = {
    _m("oMath"),
    _m("oMathPara"),
    _m("e"),
    _m("num"),
    _m("den"),
    _m("deg"),
    _m("lim"),
    _m("sup"),
    _m("sub"),
    _m("fName"),
    _m("box"),
    _m("borderBox"),
    _m("argPr"),
    _m("ctrlPr"),
    _m("mpr"),
    _m("rPr"),
}

def _mval(el) -> str:
    """Read the text of a math val attribute element (m:val), e.g. nary chr."""
    if el is None:
        return ""
    val = _find(el, "val")
    return val.text or "" if val is not None else ""

def _find(el, tag):
    if not tag.startswith("{"):
        tag = _m(tag)
    for c in el:
        if isinstance(c.tag, str) and c.tag == tag:
            return c
    return None

def _text(el):
    return "".join(_convert_omml(c) for c in el if isinstance(c.tag, str))

def _convert_omml(el) -> str:
    tag = el.tag
    if tag == _m("t"):
        return el.text or ""
    if tag == _m("r"):
        return _text(el)
    if tag in _PASSTHROUGH_TAGS:
        return _text(el)

    if tag == _m("sSup"):
        base = _convert_omml(_find(el, "e")) if _find(el, "e") is not None else ""
        sup = _convert_omml(_find(el, "sup")) if _find(el, "sup") is not None else ""
        return f"{_wrap(base)}^{sup}"
    if tag == _m("sSub"):
        base = _convert_omml(_find(el, "e")) if _find(el, "e") is not None else ""
        sub = _convert_omml(_find(el, "sub")) if _find(el, "sub") is not None else ""
        return f"{_wrap(base)}_{sub}"
    if tag == _m("sSubSup"):
        base = _convert_omml(_find(el, "e")) if _find(el, "e") is not None else ""
        sub = _convert_omml(_find(el, "sub")) if _find(el, "sub") is not None else ""
        sup = _convert_omml(_find(el, "sup")) if _find(el, "sup") is not None else ""
        return f"{_wrap(base)}_{sub}^{sup}"
    if tag == _m("f"):
        num = _convert_omml(_find(el, "num")) if _find(el, "num") is not None else ""
        den = _convert_omml(_find(el, "den")) if _find(el, "den") is not None else ""
        return f"({num})/({den})"
    if tag == _m("rad"):
        deg = _convert_omml(_find(el, "deg")) if _find(el, "deg") is not None else ""
        base = _convert_omml(_find(el, "e")) if _find(el, "e") is not None else ""
        return f"[{deg}]√({base})" if deg else f"√({base})"
    if tag == _m("limLow"):
        base = _convert_omml(_find(el, "e")) if _find(el, "e") is not None else ""
        lim = _convert_omml(_find(el, "lim")) if _find(el, "lim") is not None else ""
        return f"{base}_{{{lim}}}"
    if tag == _m("limUpp"):
        base = _convert_omml(_find(el, "e")) if _find(el, "e") is not None else ""
        lim = _convert_omml(_find(el, "lim")) if _find(el, "lim") is not None else ""
        return f"{base}^{{{lim}}}"
    if tag == _m("nary"):
        props = _find(el, "naryPr")
        chr_ = _mval(_find(props, "chr")) if props is not None else "\u222b"
        sub = _convert_omml(_find(props, "sub")) if props is not None and _find(props, "sub") is not None else ""
        sup = _convert_omml(_find(props, "sup")) if props is not None and _find(props, "sup") is not None else ""
        e = _convert_omml(_find(el, "e")) if _find(el, "e") is not None else ""
        out = chr_ or "\u222b"
        if sub:
            out += f"_{{{sub}}}"
        if sup:
            out += f"^{{{sup}}}"
        if e:
            out += f"({e})"
        return out
    if tag == _m("d"):
        props = _find(el, "dPr")
        beg = _mval(_find(props, "begChr")) if props is not None else "("
        end = _mval(_find(props, "endChr")) if props is not None else ")"
        return f"{beg}{_text(el)}{end}"
    if tag == _m("func"):
        name = _convert_omml(_find(el, "fName")) if _find(el, "fName") is not None else ""
        arg = _convert_omml(_find(el, "e")) if _find(el, "e") is not None else ""
        return f"{name}({arg})"
    if tag == _m("eqArr"):
        rows = [_convert_omml(e) for e in el if isinstance(e.tag, str) and e.tag == _m("e")]
        return " | ".join(rows)
    if tag == _m("acc"):
        props = _find(el, "accPr")
        chr_ = _mval(_find(props, "chr")) if props is not None else ""
        return f"{_text(el)}{chr_}"
    if tag == _m("bar"):
        props = _find(el, "barPr")
        pos = _mval(_find(props, "pos")) if props is not None else "top"
        body = _text(el)
        return f"\u203e{body}" if pos != "bot" else f"{body}\u203e"
    if tag == _m("groupChr"):
        props = _find(el, "groupChrPr")
        chr_ = _mval(_find(props, "chr")) if props is not None else "("
        return f"{chr_}{_text(el)}{chr_}"

    # Unknown construct: recurse and keep whatever text survives.
    return _text(el)

def _wrap(s: str) -> str:
    return s if len(s) <= 1 else f"({s})"

def _inline_text(el) -> str:
    """Collect run text / OMML without stripping — spaces between runs must survive."""
    if el.tag == _w("t"):
        return el.text or ""
    if el.tag in (_m("oMath"), _m("oMathPara")):
        return _convert_omml(el)
    if el.tag == _w("br"):
        return " "
    if el.tag == _w("tab"):
        return " "
    if el.tag == _w("instrText"):
        return ""
    if el.tag == _w("p"):
        # Nested paragraph (e.g. inside a floating text box): every line is a
        # separate paragraph, so join them with a space to keep word
        # boundaries. Without this, "Kunci Soal: E" + "No. Soal: 5" would
        # merge into "ENo." and break alignment with the PDF text layer.
        parts = [_inline_text(c) for c in el if isinstance(c.tag, str)]
        return " ".join(x for x in parts if x) + " "
    return "".join(_inline_text(c) for c in el if isinstance(c.tag, str))

def _paragraph_text(p_el) -> str:
    return "".join(_inline_text(c) for c in p_el if isinstance(c.tag, str)).strip()

def _walk_blocks(root_el):
    for child in root_el:
        if not isinstance(child.tag, str):
            continue
        if child.tag == _w("p"):
            text = _paragraph_text(child)
            if text:
                yield text
        elif child.tag == _w("tbl"):
            for row in child:
                if not isinstance(row.tag, str) or row.tag != _w("tr"):
                    continue
                for cell in row:
                    if not isinstance(cell.tag, str) or cell.tag != _w("tc"):
                        continue
                    yield from _walk_blocks(cell)

def extract_text_from_docx(file_path: str) -> list[str]:
    """
    Extract readable text blocks from a .docx in document order (paragraphs
    and table cells, depth-first). Word equations (OMML) are converted to
    linear notation such as "lim_{x->3}(x^2-5x+6)/(x^2-3x+2)" so formulas stay
    searchable instead of arriving as garbled glyph text from a PDF layer.
    """
    log_event("docx_extractor.start", "Extracting text from DOCX.", file_path=file_path)
    document = docx.Document(file_path)
    blocks = list(_walk_blocks(document.element.body))
    log_event("docx_extractor.done", "DOCX text extraction complete.", file_path=file_path, blocks=len(blocks))
    return blocks

