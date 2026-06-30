"""Tests for the v1 metadata schema (Workspace / Source / Chunk).

Run from the project root with ``pytest``.
"""

from extraction.metadata import (
    create_chunks,
    create_ingestion_record,
    create_source,
    create_workspace,
    ingest_extraction,
)

WORKSPACE_KEYS = {"workspace_id", "name", "area", "level", "created_at", "updated_at"}
SOURCE_KEYS = {
    "source_id",
    "workspace_id",
    "source_type",
    "title",
    "file_name",
    "file_type",
    "author",
    "created_at",
    "updated_at",
}
CHUNK_KEYS = {
    "chunk_id",
    "source_id",
    "workspace_id",
    "chunk_index",
    "chunk_type",
    "text",
    "token_count",
    "source_type",
    "area",
    "created_at",
    "updated_at",
}


# --------------------------------------------------------------------------- #
# Workspace
# --------------------------------------------------------------------------- #
def test_create_workspace_defaults():
    ws = create_workspace()
    assert set(ws.keys()) == WORKSPACE_KEYS
    assert ws["name"] == "Untitled Workspace"
    assert ws["area"] == "unknown"
    assert ws["level"] == "unknown"
    assert ws["workspace_id"]
    assert ws["created_at"] == ws["updated_at"]


def test_create_workspace_with_values():
    ws = create_workspace({"name": "AP Biology", "area": "biology", "level": "high_school"})
    assert ws["name"] == "AP Biology"
    assert ws["area"] == "biology"
    assert ws["level"] == "high_school"


def test_create_workspace_blank_strings_fall_back_to_defaults():
    ws = create_workspace({"name": "   ", "area": "", "level": None})
    assert ws["name"] == "Untitled Workspace"
    assert ws["area"] == "unknown"
    assert ws["level"] == "unknown"


def test_workspace_ids_are_unique():
    assert create_workspace()["workspace_id"] != create_workspace()["workspace_id"]


# --------------------------------------------------------------------------- #
# Source
# --------------------------------------------------------------------------- #
def test_create_source_defaults_and_link():
    ws = create_workspace()
    src = create_source({}, ws)
    assert set(src.keys()) == SOURCE_KEYS
    assert src["workspace_id"] == ws["workspace_id"]
    assert src["source_type"] == "unknown"
    assert src["title"] == "Untitled Source"
    assert src["file_name"] is None
    assert src["file_type"] == "unknown"
    assert src["author"] is None


def test_source_title_falls_back_to_file_name():
    ws = create_workspace()
    src = create_source({"file_name": "lecture_03.pdf"}, ws)
    assert src["title"] == "lecture_03.pdf"
    assert src["file_name"] == "lecture_03.pdf"


def test_source_explicit_title_wins():
    ws = create_workspace()
    src = create_source({"file_name": "lecture_03.pdf", "title": "Lecture 3"}, ws)
    assert src["title"] == "Lecture 3"


# --------------------------------------------------------------------------- #
# Chunks
# --------------------------------------------------------------------------- #
def test_create_chunks_single_small_text():
    ws = create_workspace({"area": "math"})
    src = create_source({"source_type": "lecture_notes"}, ws)
    chunks = create_chunks("one two three four five", ws, src)
    assert len(chunks) == 1
    chunk = chunks[0]
    assert set(chunk.keys()) == CHUNK_KEYS
    assert chunk["chunk_index"] == 0
    assert chunk["token_count"] == 5
    assert chunk["chunk_type"] == "unknown"
    # copied fields
    assert chunk["source_type"] == "lecture_notes"
    assert chunk["area"] == "math"
    # links
    assert chunk["source_id"] == src["source_id"]
    assert chunk["workspace_id"] == ws["workspace_id"]


def test_create_chunks_splits_with_overlap_and_indexes():
    ws = create_workspace()
    src = create_source({}, ws)
    text = " ".join(str(i) for i in range(1200))  # 1200 words
    chunks = create_chunks(text, ws, src, {"chunk_size": 500, "overlap": 50})
    # step = 450 -> starts at 0, 450, 900 -> 3 chunks
    assert [c["chunk_index"] for c in chunks] == [0, 1, 2]
    assert chunks[0]["token_count"] == 500
    # overlap: last 50 words of chunk 0 == first 50 words of chunk 1
    tail = chunks[0]["text"].split()[-50:]
    head = chunks[1]["text"].split()[:50]
    assert tail == head


def test_create_chunks_empty_text():
    ws = create_workspace()
    src = create_source({}, ws)
    assert create_chunks("   ", ws, src) == []


def test_create_chunks_custom_type():
    ws = create_workspace()
    src = create_source({}, ws)
    chunks = create_chunks("hello world", ws, src, {"chunk_type": "definition"})
    assert chunks[0]["chunk_type"] == "definition"


# --------------------------------------------------------------------------- #
# Ingestion record
# --------------------------------------------------------------------------- #
def test_create_ingestion_record_shape_and_relationships():
    record = create_ingestion_record(
        text="alpha beta gamma delta epsilon zeta eta theta",
        workspace_info={"name": "15-251", "area": "computer_science", "level": "undergraduate"},
        source_info={"source_type": "lecture_notes", "title": "Lecture 3: Induction"},
    )
    assert set(record.keys()) == {"workspace", "source", "chunks", "warnings"}

    ws, src, chunks = record["workspace"], record["source"], record["chunks"]
    assert src["workspace_id"] == ws["workspace_id"]
    assert len(chunks) >= 1
    for chunk in chunks:
        assert chunk["source_id"] == src["source_id"]
        assert chunk["workspace_id"] == ws["workspace_id"]
        assert chunk["source_type"] == src["source_type"]  # copied from Source
        assert chunk["area"] == ws["area"]  # copied from Workspace


def test_create_ingestion_record_empty_text_warns():
    record = create_ingestion_record(text="", workspace_info={"name": "X"})
    assert record["chunks"] == []
    assert any("0 chunks" in w for w in record["warnings"])


def test_create_ingestion_record_overlap_clamp_warning():
    record = create_ingestion_record(
        text="a b c d e f g",
        chunk_options={"chunk_size": 3, "overlap": 5},
    )
    # Should not hang, and should warn about the clamp.
    assert any("overlap" in w for w in record["warnings"])
    assert isinstance(record["chunks"], list)


# --------------------------------------------------------------------------- #
# Bridge from extraction output
# --------------------------------------------------------------------------- #
def test_ingest_extraction_from_pdf_result():
    extraction = {
        "source_type": "pdf",
        "file_name": "lecture_03_induction.pdf",
        "status": "success",
        "pages": [
            {"page_number": 1, "text": "page one words here for chunking now"},
            {"page_number": 2, "text": "page two more words to chunk here"},
        ],
        "warnings": [],
    }
    record = ingest_extraction(
        extraction,
        workspace_info={"area": "computer_science"},
        source_info={"source_type": "lecture_notes"},
    )
    assert record["source"]["file_name"] == "lecture_03_induction.pdf"
    assert record["source"]["file_type"] == "pdf"
    assert record["source"]["source_type"] == "lecture_notes"
    assert len(record["chunks"]) >= 1
    assert record["chunks"][0]["area"] == "computer_science"


def test_ingest_extraction_pasted_text_defaults():
    extraction = {
        "source_type": "pasted_text",
        "file_name": None,
        "status": "success",
        "pages": [{"page_number": None, "text": "some pasted study notes here"}],
        "warnings": [],
    }
    record = ingest_extraction(extraction)
    assert record["source"]["file_type"] == "pasted_text"
    assert record["source"]["source_type"] == "pasted_text"
    assert record["source"]["file_name"] is None


def test_ingest_extraction_carries_warnings():
    extraction = {
        "source_type": "pdf",
        "file_name": "scan.pdf",
        "status": "needs_ocr",
        "pages": [{"page_number": 1, "text": ""}],
        "warnings": ["This PDF may be scanned or image-based."],
    }
    record = ingest_extraction(extraction)
    assert any("scanned" in w.lower() for w in record["warnings"])
