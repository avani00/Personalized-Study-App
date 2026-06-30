"""Stage A vector storage layer (ChromaDB).

Stores already-created chunks (from ``extraction.metadata``) in a local,
persistent ChromaDB collection so they can be retrieved later by semantic
query. Embeddings use sentence-transformers ``all-MiniLM-L6-v2``.

This module only handles storage + retrieval. It does not chunk, extract,
generate quizzes, track progress, or build concept maps.

ChromaDB metadata must be flat scalars (str/int/float/bool) — no nested
objects or lists — so :func:`build_chunk_metadata` flattens each chunk into
that shape, applying safe defaults for unknown values.
"""

import os
from datetime import datetime, timezone

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

DEFAULT_PERSIST_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "chroma_db"
)
DEFAULT_COLLECTION = "study_chunks"
DEFAULT_EMBED_MODEL = "all-MiniLM-L6-v2"

# Metadata defaults for values we cannot determine yet.
UNKNOWN_STR = "unknown"
UNKNOWN_PAGE = -1
UNKNOWN_TOKENS = 0


def _now_iso():
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _scalar_str(value, default=UNKNOWN_STR):
    """Coerce to a non-empty string, falling back to ``default``."""
    if isinstance(value, str) and value.strip():
        return value
    return default


def _scalar_int(value, default):
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _derive_extraction_method(extraction):
    """Best-effort extraction method label from an extraction result."""
    if not extraction:
        return UNKNOWN_STR
    source_type = extraction.get("source_type")
    if source_type == "pdf":
        warns = " ".join(extraction.get("warnings", [])).lower()
        return "pdfplumber" if "pdfplumber fallback" in warns else "pymupdf"
    if source_type in ("text_file", "pasted_text"):
        return source_type
    return UNKNOWN_STR


def _derive_extraction_quality(extraction):
    if not extraction:
        return UNKNOWN_STR
    return _scalar_str(extraction.get("status"))


def build_chunk_metadata(chunk, source=None, workspace=None, extraction=None):
    """Flatten a chunk (+ its source/workspace/extraction) into Chroma metadata.

    All values are scalars with safe defaults so the result is always a valid
    ChromaDB metadata dict.
    """
    source = source or {}
    workspace = workspace or {}
    return {
        "workspace_id": _scalar_str(
            chunk.get("workspace_id") or workspace.get("workspace_id")
        ),
        "source_id": _scalar_str(chunk.get("source_id") or source.get("source_id")),
        "file_name": _scalar_str(source.get("file_name") or chunk.get("file_name")),
        "source_type": _scalar_str(
            chunk.get("source_type") or source.get("source_type")
        ),
        "file_type": _scalar_str(source.get("file_type") or chunk.get("file_type")),
        "chunk_index": _scalar_int(chunk.get("chunk_index"), UNKNOWN_PAGE),
        "page_start": _scalar_int(chunk.get("page_start"), UNKNOWN_PAGE),
        "page_end": _scalar_int(chunk.get("page_end"), UNKNOWN_PAGE),
        "section_title": _scalar_str(chunk.get("section_title")),
        "chunk_type": _scalar_str(chunk.get("chunk_type")),
        "token_count": _scalar_int(chunk.get("token_count"), UNKNOWN_TOKENS),
        "extraction_method": _derive_extraction_method(extraction),
        "extraction_quality": _derive_extraction_quality(extraction),
        "created_at": _scalar_str(chunk.get("created_at"), _now_iso()),
        # Extra (already present in the pipeline) — handy for filtering.
        "area": _scalar_str(chunk.get("area") or workspace.get("area")),
    }


def _build_where(workspace_id=None, filters=None):
    """Build a ChromaDB ``where`` clause from a workspace id + simple filters."""
    conditions = []
    if workspace_id:
        conditions.append({"workspace_id": workspace_id})
    for key, value in (filters or {}).items():
        if value is not None:
            conditions.append({key: value})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


class VectorStore:
    """Thin wrapper around a persistent ChromaDB collection of study chunks."""

    def __init__(
        self,
        persist_directory=DEFAULT_PERSIST_DIR,
        collection_name=DEFAULT_COLLECTION,
        embed_model=DEFAULT_EMBED_MODEL,
    ):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        os.makedirs(persist_directory, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(anonymized_telemetry=False),
        )
        self._embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=embed_model
        )
        self._collection = self._get_or_create_collection()

    def _get_or_create_collection(self):
        return self._client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )

    # -- write -------------------------------------------------------------- #
    def add_chunks(self, chunks, source=None, workspace=None, extraction=None):
        """Embed and store chunks. Returns the number of chunks stored.

        ``chunks`` are the chunk dicts produced by the existing pipeline.
        ``source``/``workspace``/``extraction`` are optional and only used to
        enrich metadata (file_name, file_type, extraction_method/quality).
        Uses upsert so re-adding the same chunk_id is idempotent.
        """
        chunks = [c for c in (chunks or []) if c.get("text", "").strip()]
        if not chunks:
            return 0

        ids = [str(c["chunk_id"]) for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [
            build_chunk_metadata(c, source=source, workspace=workspace, extraction=extraction)
            for c in chunks
        ]
        self._collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        return len(chunks)

    # -- read --------------------------------------------------------------- #
    def search_chunks(self, query, workspace_id=None, top_k=5, filters=None):
        """Semantic search. Returns a list of result dicts sorted best-first.

        Each result: ``{chunk_id, text, metadata, distance, score}`` where
        ``score = 1 - distance`` (cosine similarity).
        """
        where = _build_where(workspace_id=workspace_id, filters=filters)
        result = self._collection.query(
            query_texts=[query],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        ids = (result.get("ids") or [[]])[0]
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]

        out = []
        for i, chunk_id in enumerate(ids):
            distance = distances[i] if i < len(distances) else None
            out.append(
                {
                    "chunk_id": chunk_id,
                    "text": documents[i] if i < len(documents) else "",
                    "metadata": metadatas[i] if i < len(metadatas) else {},
                    "distance": distance,
                    "score": (1.0 - distance) if distance is not None else None,
                }
            )
        return out

    def get_chunk(self, chunk_id):
        """Return one stored chunk by id, or None if not found."""
        result = self._collection.get(
            ids=[str(chunk_id)], include=["documents", "metadatas"]
        )
        ids = result.get("ids") or []
        if not ids:
            return None
        documents = result.get("documents") or [""]
        metadatas = result.get("metadatas") or [{}]
        return {
            "chunk_id": ids[0],
            "text": documents[0] if documents else "",
            "metadata": metadatas[0] if metadatas else {},
        }

    def count_chunks(self, workspace_id=None):
        """Count stored chunks, optionally restricted to a workspace."""
        if not workspace_id:
            return self._collection.count()
        result = self._collection.get(where={"workspace_id": workspace_id}, include=[])
        return len(result.get("ids") or [])

    # -- delete ------------------------------------------------------------- #
    def delete_source(self, source_id):
        """Delete all chunks belonging to a given source. Returns count removed."""
        before = self._collection.get(where={"source_id": source_id}, include=[])
        removed = len(before.get("ids") or [])
        if removed:
            self._collection.delete(where={"source_id": source_id})
        return removed

    def reset(self):
        """Drop and recreate the collection (clears all stored chunks)."""
        self._client.delete_collection(name=self.collection_name)
        self._collection = self._get_or_create_collection()
