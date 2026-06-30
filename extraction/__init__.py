"""Stage A document extraction + v1 metadata package."""

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
from .metadata import (
    create_chunks,
    create_ingestion_record,
    create_source,
    create_workspace,
    ingest_extraction,
)

__all__ = [
    # extraction
    "extract_file",
    "extract_pdf",
    "extract_text_file",
    "extract_pasted_text",
    "STATUS_SUCCESS",
    "STATUS_UNSUPPORTED",
    "STATUS_NEEDS_OCR",
    "STATUS_ERROR",
    # metadata (v1 schema)
    "create_workspace",
    "create_source",
    "create_chunks",
    "create_ingestion_record",
    "ingest_extraction",
]
