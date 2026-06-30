"""Connect the existing extraction/chunking pipeline to the vector store.

This is the glue that runs after extraction/cleaning/chunking: it builds the
v1 ingestion record and then persists the resulting chunks in ChromaDB.
"""

from extraction import extract_file, extract_pasted_text, ingest_extraction


def ingest_and_store(
    store,
    path=None,
    text=None,
    workspace_info=None,
    source_info=None,
    chunk_options=None,
):
    """Extract -> chunk -> store one piece of study material.

    Provide exactly one of ``path`` (a .pdf/.txt/.md file) or ``text``
    (pasted text). Returns:

        {
            "extraction": {...},   # raw extraction result
            "record": {...},       # ingestion record (workspace/source/chunks)
            "stored": int,         # number of chunks written to ChromaDB
        }
    """
    if path is not None and text is not None:
        raise ValueError("Provide either 'path' or 'text', not both.")
    if path is not None:
        extraction = extract_file(path)
    elif text is not None:
        extraction = extract_pasted_text(text)
    else:
        raise ValueError("Provide either 'path' or 'text'.")

    record = ingest_extraction(
        extraction,
        workspace_info=workspace_info,
        source_info=source_info,
        chunk_options=chunk_options,
    )
    stored = store.add_chunks(
        record["chunks"],
        source=record["source"],
        workspace=record["workspace"],
        extraction=extraction,
    )
    return {"extraction": extraction, "record": record, "stored": stored}
