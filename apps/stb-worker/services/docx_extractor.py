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

# Unicode math characters commonly found inside OMML text runs, mapped to
# LaTeX so the output renders correctly in KaTeX.
_UNICODE_TO_LATEX = {
    "\u2192": r"\to ",
    "\u2190": r"\gets ",
    "\u00d7": r"\times ",
    "\u00f7": r"\div ",
    "\u00b1": r"\pm ",
    "\u221e": r"\infty ",
    "\u2264": r"\leq ",
    "\u2265": r"\geq ",
    "\u2260": r"\neq ",
    "\u2248": r"\approx ",
    "\u2208": r"\in ",
    "\u2209": r"\notin ",
    "\u2282": r"\subset ",
    "\u2286": r"\subseteq ",
    "\u222a": r"\cup ",
    "\u2229": r"\cap ",
    "\u22c5": r"\cdot ",
    "\u2212": "-",
    "\u2218": r"\circ ",
    "\u221a": r"\surd ",
    "\u2234": r"\therefore ",
    "\u2235": r"\because ",
}

# Characters that must be escaped inside LaTeX math text.
_LATEX_ESCAPES = {
    "\\": r"\textbackslash{}",
    "{": r"\{",
    "}": r"\}",
    "$": r"\$",
    "&": r"\&",
    "#": r"\#",
    "%": r"\%",
    "_": r"\_",
    "^": r"\textasciicircum{}",
    "~": r"\textasciitilde{}",
}

# OMML nary operator characters -> LaTeX commands.
_NARY_COMMANDS = {
    "\u222b": r"\int",
    "\u222c": r"\iint",
    "\u222d": r"\iiint",
    "\u2211": r"\sum",
    "\u220f": r"\prod",
    "\u22c3": r"\bigcup",
    "\u22c2": r"\bigcap",
    "\u2a01": r"\bigoplus",
    "\u2a02": r"\bigotimes",
}

# OMML accent characters -> LaTeX accent commands.
_ACCENT_COMMANDS = {
    "\u2192": r"\vec",
    "\u02c6": r"\hat",
    "\u203e": r"\bar",
    "\u0303": r"\tilde",
    "\u0307": r"\dot",
    "\u0308": r"\ddot",
}

# Plain-text operator names (typically the base of m:limLow / m:limUpp) that
# must become LaTeX commands to render upright with correct spacing.
_OPERATOR_NAMES = {
    "lim": r"\lim",
    "max": r"\max",
    "min": r"\min",
    "sup": r"\sup",
    "inf": r"\inf",
    "arg": r"\arg",
    "det": r"\det",
    "gcd": r"\gcd",
    "lg": r"\lg",
    "ln": r"\ln",
    "log": r"\log",
    "exp": r"\exp",
    "sin": r"\sin",
    "cos": r"\cos",
    "tan": r"\tan",
    "cot": r"\cot",
    "sec": r"\sec",
    "csc": r"\csc",
    "sinh": r"\sinh",
    "cosh": r"\cosh",
    "tanh": r"\tanh",
    "arcsin": r"\arcsin",
    "arccos": r"\arccos",
    "arctan": r"\arctan",
    "mod": r"\bmod",
}

def _tex_escape(text: str) -> str:
    out = []
    for ch in text:
        if ch in _UNICODE_TO_LATEX:
            out.append(_UNICODE_TO_LATEX[ch])
        elif ch in _LATEX_ESCAPES:
            out.append(_LATEX_ESCAPES[ch])
        else:
            out.append(ch)
    return "".join(out)

def _text(el):
    return "".join(_convert_omml(c) for c in el if isinstance(c.tag, str))

def _child(el, name: str) -> str:
    found = _find(el, name)
    return _convert_omml(found) if found is not None else ""

def _convert_omml(el) -> str:
    """Convert an OMML element to LaTeX math. Called on the math body; the
    `$...$` / `$$...$$` delimiters are added by the paragraph collector."""
    tag = el.tag
    if tag == _m("t"):
        return _tex_escape(el.text or "")
    if tag == _m("r"):
        return _text(el)
    if tag in _PASSTHROUGH_TAGS:
        return _text(el)

    if tag == _m("sSup"):
        return f"{_child(el, 'e')}^{{{_child(el, 'sup')}}}"
    if tag == _m("sSub"):
        return f"{_child(el, 'e')}_{{{_child(el, 'sub')}}}"
    if tag == _m("sSubSup"):
        return f"{_child(el, 'e')}_{{{_child(el, 'sub')}}}^{{{_child(el, 'sup')}}}"
    if tag == _m("f"):
        return f"\\frac{{{_child(el, 'num')}}}{{{_child(el, 'den')}}}"
    if tag == _m("rad"):
        deg = _child(el, "deg")
        base = _child(el, "e")
        return f"\\sqrt[{deg}]{{{base}}}" if deg else f"\\sqrt{{{base}}}"
    if tag == _m("limLow"):
        base = _child(el, "e")
        lim = _child(el, "lim")
        op = _OPERATOR_NAMES.get(base.strip())
        return f"{op or base}_{{{lim}}}"
    if tag == _m("limUpp"):
        base = _child(el, "e")
        lim = _child(el, "lim")
        op = _OPERATOR_NAMES.get(base.strip())
        return f"{op or base}^{{{lim}}}"
    if tag == _m("nary"):
        props = _find(el, "naryPr")
        chr_ = _mval(_find(props, "chr")) if props is not None else "\u222b"
        cmd = _NARY_COMMANDS.get(chr_, chr_ or r"\int")
        sub = _child(props, "sub") if props is not None else ""
        sup = _child(props, "sup") if props is not None else ""
        e = _child(el, "e")
        out = cmd
        if sub:
            out += f"_{{{sub}}}"
        if sup:
            out += f"^{{{sup}}}"
        if e:
            out += f" {e}"
        return out
    if tag == _m("d"):
        props = _find(el, "dPr")
        beg = _mval(_find(props, "begChr")) if props is not None else "("
        end = _mval(_find(props, "endChr")) if props is not None else ")"
        body = _text(el)
        if beg in ("(", "[", "|", "\\{") and end in (")", "]", "|", "\\}"):
            return f"\\left{beg}{body}\\right{end}"
        return f"{beg}{body}{end}"
    if tag == _m("func"):
        name = _child(el, "fName")
        arg = _child(el, "e")
        return f"\\operatorname{{{name}}}({arg})" if name else f"({arg})"
    if tag == _m("eqArr"):
        rows = [_convert_omml(e) for e in el if isinstance(e.tag, str) and e.tag == _m("e")]
        return " \\qquad ".join(rows)
    if tag == _m("m"):
        rows = []
        for mr in el:
            if isinstance(mr.tag, str) and mr.tag == _m("mr"):
                cells = [_convert_omml(e) for e in mr if isinstance(e.tag, str) and e.tag == _m("e")]
                rows.append(" & ".join(cells))
        if rows:
            return "\\begin{matrix} " + " \\\\ ".join(rows) + " \\end{matrix}"
        return ""
    if tag == _m("acc"):
        props = _find(el, "accPr")
        chr_ = _mval(_find(props, "chr")) if props is not None else ""
        body = _text(el)
        cmd = _ACCENT_COMMANDS.get(chr_)
        if cmd:
            return f"{cmd}{{{body}}}"
        return f"{body}{chr_}" if chr_ else body
    if tag == _m("bar"):
        props = _find(el, "barPr")
        pos = _mval(_find(props, "pos")) if props is not None else "top"
        body = _text(el)
        return f"\\overline{{{body}}}" if pos != "bot" else f"\\underline{{{body}}}"
    if tag == _m("groupChr"):
        props = _find(el, "groupChrPr")
        chr_ = _mval(_find(props, "chr")) if props is not None else "("
        body = _text(el)
        if chr_ == "\u23de":
            return f"\\overbrace{{{body}}}"
        if chr_ == "\u23df":
            return f"\\underbrace{{{body}}}"
        return f"{chr_}{body}{chr_}"

    # Unknown construct: recurse and keep whatever text survives.
    return _text(el)

def _inline_text(el) -> str:
    """Collect run text / OMML without stripping — spaces between runs must survive."""
    if el.tag == _w("t"):
        return el.text or ""
    if el.tag == _m("oMathPara"):
        # Display equation — KaTeX display mode.
        return "$$" + _convert_omml(el) + "$$"
    if el.tag == _m("oMath"):
        # Inline equation — KaTeX inline mode.
        return "$" + _convert_omml(el) + "$"
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
    LaTeX wrapped in $...$ / $$...$$ delimiters, e.g.
    "$\\lim_{x \\to 3} \\frac{x^{2}-5x+6}{x^{2}-3x+2}$", so formulas stay
    searchable and render with KaTeX instead of arriving as garbled glyph
    text from a PDF layer.
    """
    log_event("docx_extractor.start", "Extracting text from DOCX.", file_path=file_path)
    document = docx.Document(file_path)
    blocks = list(_walk_blocks(document.element.body))
    log_event("docx_extractor.done", "DOCX text extraction complete.", file_path=file_path, blocks=len(blocks))
    return blocks

