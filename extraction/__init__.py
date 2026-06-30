"""Stage A document extraction package."""

from .extractor import (
    STATUS_ERROR,
    STATUS_NEEDS_OCR,
    STATUS_SUCCESS,
    STATUS_UNSUPPORTED,
    extract_file,
    extract_pasted_text,
    extract_pdf,
    extract_text_file,
)

__all__ = [
    "extract_file",
    "extract_pdf",
    "extract_text_file",
    "extract_pasted_text",
    "STATUS_SUCCESS",
    "STATUS_UNSUPPORTED",
    "STATUS_NEEDS_OCR",
    "STATUS_ERROR",
]
