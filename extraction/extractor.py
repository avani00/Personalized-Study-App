"""Stage A — document text extraction.

Supports pasted text, .txt/.md files, and digital PDFs (PyMuPDF, with an
optional pdfplumber fallback). Scanned/image PDFs are detected and flagged
for OCR but NOT processed here.

Every entry point returns the same structured dict:

    {
        "source_type": "pdf" | "text_file" | "pasted_text",
        "file_name": str | None,
        "status": "success" | "unsupported" | "needs_ocr" | "error",
        "pages": [{"page_number": int | None, "text": str}, ...],
        "warnings": [str, ...],
    }
"""

import os
import re

from .cleaning import clean_text

# --- Status values ---
STATUS_SUCCESS = "success"
STATUS_UNSUPPORTED = "unsupported"
STATUS_NEEDS_OCR = "needs_ocr"
STATUS_ERROR = "error"

# --- Source types ---
SOURCE_PDF = "pdf"
SOURCE_TEXT_FILE = "text_file"
SOURCE_PASTED_TEXT = "pasted_text"

TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".text"}

# Thresholds used to decide whether a PDF likely needs OCR (scanned/image).
MIN_TOTAL_CHARS = 50
MIN_CHARS_PER_PAGE = 20


def _result(source_type, file_name, status, pages=None, warnings=None):
    return {
        "source_type": source_type,
        "file_name": file_name,
        "status": status,
        "pages": pages if pages is not None else [],
        "warnings": warnings if warnings is not None else [],
    }


def _meaningful_char_count(pages):
    """Count non-whitespace characters across all pages."""
    return sum(len(re.sub(r"\s+", "", page["text"])) for page in pages)


def _looks_too_short(pages):
    """Heuristic: does this extraction look empty/sparse (likely scanned)?"""
    if not pages:
        return True
    total = _meaningful_char_count(pages)
    if total < MIN_TOTAL_CHARS:
        return True
    return (total / len(pages)) < MIN_CHARS_PER_PAGE


def _import_fitz():
    """Import PyMuPDF, which exposes both ``pymupdf`` and ``fitz`` names."""
    try:
        import pymupdf  # noqa: PLC0415

        return pymupdf
    except ImportError:
        import fitz  # noqa: PLC0415

        return fitz


def _extract_pdf_pymupdf(path):
    fitz = _import_fitz()
    pages = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc, start=1):
            raw = page.get_text("text")
            pages.append({"page_number": i, "text": clean_text(raw)})
    return pages


def _extract_pdf_pdfplumber(path):
    import pdfplumber  # noqa: PLC0415

    pages = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            raw = page.extract_text() or ""
            pages.append({"page_number": i, "text": clean_text(raw)})
    return pages


def extract_pdf(path):
    """Extract text from a digital PDF, page by page."""
    file_name = os.path.basename(path)
    warnings = []

    # Primary extractor: PyMuPDF.
    try:
        pages = _extract_pdf_pymupdf(path)
    except ImportError:
        return _result(
            SOURCE_PDF,
            file_name,
            STATUS_ERROR,
            warnings=["PyMuPDF (pymupdf) is not installed. Run: pip install pymupdf"],
        )
    except Exception as exc:  # corrupt/encrypted/not-a-pdf, etc.
        return _result(
            SOURCE_PDF,
            file_name,
            STATUS_ERROR,
            warnings=[f"Failed to read PDF with PyMuPDF: {exc}"],
        )

    if not _looks_too_short(pages):
        return _result(SOURCE_PDF, file_name, STATUS_SUCCESS, pages, warnings)

    # PyMuPDF output looks sparse — try the optional pdfplumber fallback.
    warnings.append("PyMuPDF extracted very little text; trying pdfplumber fallback.")
    try:
        fallback_pages = _extract_pdf_pdfplumber(path)
        if not _looks_too_short(fallback_pages):
            warnings.append("Used pdfplumber fallback for extraction.")
            return _result(SOURCE_PDF, file_name, STATUS_SUCCESS, fallback_pages, warnings)
        # Keep whichever extractor produced more text for the (sparse) output.
        if _meaningful_char_count(fallback_pages) > _meaningful_char_count(pages):
            pages = fallback_pages
    except ImportError:
        warnings.append("pdfplumber is not installed; skipped fallback.")
    except Exception as exc:
        warnings.append(f"pdfplumber fallback failed: {exc}")

    # Still sparse after both extractors -> likely scanned/image-based.
    warnings.append("This PDF may be scanned or image-based.")
    return _result(SOURCE_PDF, file_name, STATUS_NEEDS_OCR, pages, warnings)


def extract_text_file(path):
    """Extract text from a .txt or .md file (single page, page_number=None)."""
    file_name = os.path.basename(path)
    ext = os.path.splitext(path)[1].lower()

    if ext not in TEXT_EXTENSIONS:
        return _result(
            SOURCE_TEXT_FILE,
            file_name,
            STATUS_UNSUPPORTED,
            warnings=[f"Unsupported file type '{ext}'. Supported: .txt, .md"],
        )

    try:
        with open(path, "r", encoding="utf-8") as fh:
            raw = fh.read()
    except FileNotFoundError:
        return _result(SOURCE_TEXT_FILE, file_name, STATUS_ERROR, warnings=["File not found."])
    except UnicodeDecodeError:
        # Fall back to a permissive encoding rather than crashing.
        try:
            with open(path, "r", encoding="latin-1") as fh:
                raw = fh.read()
        except Exception as exc:
            return _result(
                SOURCE_TEXT_FILE, file_name, STATUS_ERROR, warnings=[f"Failed to read file: {exc}"]
            )
    except Exception as exc:
        return _result(
            SOURCE_TEXT_FILE, file_name, STATUS_ERROR, warnings=[f"Failed to read file: {exc}"]
        )

    cleaned = clean_text(raw)
    warnings = [] if cleaned else ["File contained no readable text."]
    return _result(
        SOURCE_TEXT_FILE,
        file_name,
        STATUS_SUCCESS,
        [{"page_number": None, "text": cleaned}],
        warnings,
    )


def extract_pasted_text(text):
    """Clean and wrap pasted text (single page, page_number=None)."""
    cleaned = clean_text(text or "")
    if not cleaned:
        return _result(
            SOURCE_PASTED_TEXT, None, STATUS_ERROR, warnings=["No text provided."]
        )
    return _result(
        SOURCE_PASTED_TEXT,
        None,
        STATUS_SUCCESS,
        [{"page_number": None, "text": cleaned}],
    )


def extract_file(path):
    """Dispatch a file path to the right extractor based on its extension."""
    if not os.path.exists(path):
        return _result(
            SOURCE_TEXT_FILE,
            os.path.basename(path),
            STATUS_ERROR,
            warnings=[f"Path does not exist: {path}"],
        )
    if not os.path.isfile(path):
        return _result(
            SOURCE_TEXT_FILE,
            os.path.basename(path),
            STATUS_ERROR,
            warnings=[f"Not a file: {path}"],
        )

    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return extract_pdf(path)
    return extract_text_file(path)
