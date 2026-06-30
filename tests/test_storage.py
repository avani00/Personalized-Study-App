"""Tests for the ChromaDB vector storage layer.

These require chromadb + sentence-transformers (and load a small embedding
model on first run), so the whole module is skipped if they aren't installed.
Each test isolates itself with unique workspace/source ids so they don't
interfere with one another.
"""

import uuid

import pytest

pytest.importorskip("chromadb")
pytest.importorskip("sentence_transformers")

from storage import VectorStore, build_chunk_metadata  # noqa: E402

SCALAR_TYPES = (str, int, float, bool)


def _chunk(text, workspace_id, source_id, index=0, **extra):
    chunk = {
        "chunk_id": str(uuid.uuid4()),
        "text": text,
        "workspace_id": workspace_id,
        "source_id": source_id,
        "chunk_index": index,
        "chunk_type": "unknown",
        "token_count": len(text.split()),
        "source_type": "lecture_notes",
        "area": "computer_science",
        "created_at": "2026-06-30T00:00:00.000Z",
    }
    chunk.update(extra)
    return chunk


@pytest.fixture(scope="module")
def store(tmp_path_factory):
    path = tmp_path_factory.mktemp("chroma")
    return VectorStore(persist_directory=str(path), collection_name="test_chunks")


# --------------------------------------------------------------------------- #
# Metadata flattening (no store needed)
# --------------------------------------------------------------------------- #
def test_build_chunk_metadata_scalars_and_defaults():
    md = build_chunk_metadata(
        {"text": "hi", "chunk_index": 2},
        source={"file_name": None, "file_type": "pdf", "source_id": "s1"},
        workspace={"area": "math", "workspace_id": "w1"},
        extraction={"source_type": "pdf", "status": "success", "warnings": []},
    )
    # Every value must be a Chroma-safe scalar (no None/list/dict).
    for key, value in md.items():
        assert isinstance(value, SCALAR_TYPES), f"{key}={value!r} is not scalar"
    assert md["file_name"] == "unknown"  # None -> default
    assert md["page_start"] == -1 and md["page_end"] == -1
    assert md["token_count"] == 0
    assert md["chunk_index"] == 2
    assert md["extraction_method"] == "pymupdf"
    assert md["extraction_quality"] == "success"
    assert md["area"] == "math"


def test_build_chunk_metadata_detects_pdfplumber_fallback():
    md = build_chunk_metadata(
        {"text": "hi"},
        extraction={
            "source_type": "pdf",
            "status": "success",
            "warnings": ["Used pdfplumber fallback for extraction."],
        },
    )
    assert md["extraction_method"] == "pdfplumber"


# --------------------------------------------------------------------------- #
# Store operations
# --------------------------------------------------------------------------- #
def test_add_and_count(store):
    ws, src = str(uuid.uuid4()), str(uuid.uuid4())
    chunks = [
        _chunk("first chunk about recursion", ws, src, 0),
        _chunk("second chunk about induction", ws, src, 1),
    ]
    n = store.add_chunks(
        chunks,
        source={"file_name": "notes.pdf", "file_type": "pdf", "source_id": src},
        workspace={"workspace_id": ws, "area": "computer_science"},
    )
    assert n == 2
    assert store.count_chunks(workspace_id=ws) == 2
    assert store.count_chunks(workspace_id=str(uuid.uuid4())) == 0


def test_add_chunks_skips_empty_text(store):
    ws, src = str(uuid.uuid4()), str(uuid.uuid4())
    chunks = [_chunk("   ", ws, src, 0), _chunk("real content here", ws, src, 1)]
    n = store.add_chunks(chunks)
    assert n == 1


def test_search_returns_relevant_chunk(store):
    ws, src = str(uuid.uuid4()), str(uuid.uuid4())
    recursion = _chunk(
        "A base case stops a recursive function from calling itself forever.",
        ws,
        src,
        0,
    )
    probability = _chunk(
        "Expected value is the probability-weighted average of outcomes.",
        ws,
        src,
        1,
    )
    store.add_chunks([recursion, probability])

    results = store.search_chunks(
        "expected value and probability", workspace_id=ws, top_k=2
    )
    assert results
    assert results[0]["chunk_id"] == probability["chunk_id"]
    # score should be a similarity in a sane range
    assert results[0]["score"] is not None


def test_search_respects_filters(store):
    ws, src = str(uuid.uuid4()), str(uuid.uuid4())
    exam = _chunk("midterm practice problem on graphs", ws, src, 0, source_type="exam")
    lecture = _chunk(
        "lecture notes on graph traversal", ws, src, 1, source_type="lecture_notes"
    )
    store.add_chunks([exam, lecture])

    results = store.search_chunks(
        "graphs", workspace_id=ws, filters={"source_type": "exam"}, top_k=5
    )
    assert results
    assert all(r["metadata"]["source_type"] == "exam" for r in results)


def test_get_chunk(store):
    ws, src = str(uuid.uuid4()), str(uuid.uuid4())
    chunk = _chunk("uniquely identifiable chunk text", ws, src, 0)
    store.add_chunks([chunk])

    got = store.get_chunk(chunk["chunk_id"])
    assert got is not None
    assert got["text"] == "uniquely identifiable chunk text"
    assert got["metadata"]["workspace_id"] == ws

    assert store.get_chunk("does-not-exist") is None


def test_delete_source(store):
    ws, src = str(uuid.uuid4()), str(uuid.uuid4())
    store.add_chunks(
        [_chunk("alpha", ws, src, 0), _chunk("beta", ws, src, 1)]
    )
    assert store.count_chunks(workspace_id=ws) == 2

    removed = store.delete_source(src)
    assert removed == 2
    assert store.count_chunks(workspace_id=ws) == 0
