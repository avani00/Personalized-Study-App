"""v1 metadata schema for ingested study material.

Every piece of study material (pasted, uploaded, or extracted) is organized
into three nested objects:

    Workspace  -- the study context (course / subject / exam area)
      Source   -- one uploaded or inputted piece of material
        Chunk  -- one smaller piece of extracted text

This module only builds those objects. It deliberately does NOT touch
embeddings, vector search, storage, question generation, or concept maps.

Relationships:
  - One Workspace has many Sources; a Source belongs to one Workspace.
  - One Source has many Chunks; a Chunk belongs to one Source + Workspace.
  - Each Chunk copies ``source_type`` from its Source and ``area`` from its
    Workspace for easier filtering later.
"""

import os
import uuid
from datetime import datetime, timezone

# Default chunking parameters (simple word-based chunking).
DEFAULT_CHUNK_SIZE = 500  # words per chunk
DEFAULT_CHUNK_OVERLAP = 50  # words shared between adjacent chunks


def _new_id():
    """Return a unique string ID."""
    return str(uuid.uuid4())


def _now_iso():
    """Return an ISO 8601 UTC timestamp, e.g. '2026-06-30T21:43:12.345Z'."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _first_nonempty(*values):
    """Return the first value that is a non-empty string, else None."""
    for value in values:
        if isinstance(value, str) and value.strip():
            return value
    return None


def create_workspace(workspace_info=None):
    """Build a Workspace object, filling in defaults for missing fields."""
    info = workspace_info or {}
    now = _now_iso()
    return {
        "workspace_id": _new_id(),
        "name": _first_nonempty(info.get("name")) or "Untitled Workspace",
        "area": _first_nonempty(info.get("area")) or "unknown",
        "level": _first_nonempty(info.get("level")) or "unknown",
        "created_at": now,
        "updated_at": now,
    }


def create_source(source_info=None, workspace=None):
    """Build a Source object linked to ``workspace``, applying defaults.

    ``title`` falls back to ``file_name`` when not provided, then to
    "Untitled Source".
    """
    info = source_info or {}
    now = _now_iso()
    file_name = _first_nonempty(info.get("file_name"))  # None if blank
    title = _first_nonempty(info.get("title"), file_name) or "Untitled Source"
    return {
        "source_id": _new_id(),
        "workspace_id": workspace["workspace_id"] if workspace else None,
        "source_type": _first_nonempty(info.get("source_type")) or "unknown",
        "title": title,
        "file_name": file_name,
        "file_type": _first_nonempty(info.get("file_type")) or "unknown",
        "author": _first_nonempty(info.get("author")),  # None if blank
        "created_at": now,
        "updated_at": now,
    }


def _split_into_word_chunks(words, chunk_size, overlap):
    """Yield lists of words of length ``chunk_size`` sliding by the step."""
    step = max(1, chunk_size - overlap)
    start = 0
    total = len(words)
    while start < total:
        yield words[start : start + chunk_size]
        if start + chunk_size >= total:
            break
        start += step


def create_chunks(text, workspace, source, options=None):
    """Split ``text`` into Chunk objects using simple word-based chunking.

    Options (all optional):
      - chunk_size: target words per chunk (default 500)
      - overlap:    words shared between adjacent chunks (default 50)
      - chunk_type: classification label for each chunk (default "unknown")
    """
    options = options or {}
    chunk_size = options.get("chunk_size", DEFAULT_CHUNK_SIZE)
    overlap = options.get("overlap", DEFAULT_CHUNK_OVERLAP)
    chunk_type = _first_nonempty(options.get("chunk_type")) or "unknown"

    words = (text or "").split()
    if not words:
        return []

    chunks = []
    for index, piece in enumerate(_split_into_word_chunks(words, chunk_size, overlap)):
        chunk_text = " ".join(piece)
        now = _now_iso()
        chunks.append(
            {
                "chunk_id": _new_id(),
                "source_id": source["source_id"],
                "workspace_id": workspace["workspace_id"],
                "chunk_index": index,
                "chunk_type": chunk_type,
                "text": chunk_text,
                # Approximate token count via whitespace word count.
                "token_count": len(chunk_text.split()),
                "source_type": source["source_type"],  # copied from Source
                "area": workspace["area"],  # copied from Workspace
                "created_at": now,
                "updated_at": now,
            }
        )
    return chunks


def create_ingestion_record(text=None, workspace_info=None, source_info=None, chunk_options=None):
    """Build the full ingestion record for a piece of study material.

    Returns:
        {
            "workspace": {...},
            "source": {...},
            "chunks": [...],
            "warnings": [...],
        }
    """
    warnings = []
    workspace = create_workspace(workspace_info)
    source = create_source(source_info, workspace)

    options = dict(chunk_options or {})
    if options.get("overlap", DEFAULT_CHUNK_OVERLAP) >= options.get(
        "chunk_size", DEFAULT_CHUNK_SIZE
    ):
        warnings.append(
            "chunk overlap >= chunk size; clamped to avoid an infinite loop."
        )

    if not text or not text.strip():
        warnings.append("No text provided; created 0 chunks.")
        chunks = []
    else:
        chunks = create_chunks(text, workspace, source, options)

    return {
        "workspace": workspace,
        "source": source,
        "chunks": chunks,
        "warnings": warnings,
    }


def _derive_file_type(source_type, file_name):
    """Map an extraction source_type / file name to a v1 file_type value."""
    if source_type == "pdf":
        return "pdf"
    if source_type == "pasted_text":
        return "pasted_text"
    if file_name:
        ext = os.path.splitext(file_name)[1].lower().lstrip(".")
        if ext:
            return ext
    return "unknown"


def ingest_extraction(extraction, workspace_info=None, source_info=None, chunk_options=None):
    """Bridge: turn an extraction result (from ``extraction.extractor``) into
    an ingestion record.

    Derives sensible Source defaults (file_name, file_type, and source_type
    for pasted text) from the extraction output, then concatenates page text
    and chunks it. Extraction warnings are carried into the record.
    """
    src_info = dict(source_info or {})
    ex_source_type = extraction.get("source_type")
    ex_file_name = extraction.get("file_name")

    src_info.setdefault("file_name", ex_file_name)
    if not src_info.get("file_type"):
        src_info["file_type"] = _derive_file_type(ex_source_type, ex_file_name)
    if not src_info.get("source_type") and ex_source_type == "pasted_text":
        src_info["source_type"] = "pasted_text"

    text = "\n\n".join(
        page["text"] for page in extraction.get("pages", []) if page.get("text")
    )

    record = create_ingestion_record(
        text=text,
        workspace_info=workspace_info,
        source_info=src_info,
        chunk_options=chunk_options,
    )
    # Surface extraction warnings (e.g. needs_ocr) alongside ingestion ones.
    record["warnings"] = list(extraction.get("warnings", [])) + record["warnings"]
    return record
