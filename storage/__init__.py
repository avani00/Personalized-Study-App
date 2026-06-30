"""Stage A vector storage package (ChromaDB)."""

from .pipeline import ingest_and_store
from .vector_store import VectorStore, build_chunk_metadata

__all__ = [
    "VectorStore",
    "build_chunk_metadata",
    "ingest_and_store",
]
