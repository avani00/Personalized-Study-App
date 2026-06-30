#!/usr/bin/env python3
"""End-to-end test of the Stage A storage flow: extract -> chunk -> store -> query.

Runs with zero arguments using a built-in multi-topic sample, or point it at
your own file:

    python test_storage.py
    python test_storage.py --file "/path/to/notes.pdf" --query "what is a base case?"

It will:
  1. (optionally) reset the ChromaDB collection,
  2. ingest + store the material,
  3. report how many chunks were stored,
  4. run a semantic query and print the top retrieved chunks.

By default it resets the collection so chunk counts are deterministic; pass
--no-reset to keep accumulating.
"""

import argparse

from storage import VectorStore, ingest_and_store

# A few distinct topics so semantic retrieval is meaningful.
SAMPLE_TEXT = """Recursion and Base Cases

A recursive function solves a problem by calling itself on smaller inputs.
Every recursion needs a base case that stops the calls; without a base case
the function recurses forever and overflows the call stack. The recursive
case must always move the input toward the base case.

Mathematical Induction

Induction proves a statement P(n) for all natural numbers. It has a base
case showing P(0) is true and an inductive step showing P(k) implies P(k+1).
Strong induction may assume P(0) through P(k) in the inductive step.

Graph Traversal

Breadth-first search explores a graph level by level using a queue, while
depth-first search uses a stack or recursion to go as deep as possible
before backtracking. Both visit every reachable vertex exactly once.

Probability Basics

The expected value of a random variable is the probability-weighted average
of its possible outcomes. Linearity of expectation says the expected value
of a sum equals the sum of expected values, even when variables depend on
each other.
"""

# Small chunks so the short sample splits into several retrievable pieces.
DEMO_CHUNK_OPTIONS = {"chunk_size": 45, "overlap": 8}


def _print_results(query, results):
    print(f'\nQuery: "{query}"')
    print(f"Top {len(results)} retrieved chunks:")
    print("-" * 70)
    for rank, r in enumerate(results, start=1):
        md = r["metadata"]
        score = r["score"]
        dist = r["distance"]
        preview = r["text"][:140].replace("\n", " ")
        print(f"#{rank}  score={score:.3f}  distance={dist:.3f}")
        print(f"     file_name   : {md.get('file_name')}")
        print(f"     pages       : {md.get('page_start')}-{md.get('page_end')}")
        print(f"     chunk_type  : {md.get('chunk_type')}  (index {md.get('chunk_index')})")
        print(f"     source_type : {md.get('source_type')}  extraction={md.get('extraction_method')}/{md.get('extraction_quality')}")
        print(f"     preview     : {preview}{'...' if len(r['text']) > 140 else ''}")
        print("-" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Stage A storage flow test (ChromaDB).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--file", help="Path to a .pdf/.txt/.md file (else uses a sample)")
    parser.add_argument(
        "--query", default="how does a base case stop recursion?", help="Semantic query"
    )
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--workspace-name", default="15-251 Theoretical CS")
    parser.add_argument("--area", default="computer_science")
    parser.add_argument("--level", default="undergraduate")
    parser.add_argument("--source-type", default="lecture_notes")
    parser.add_argument("--title", default=None)
    parser.add_argument(
        "--no-reset",
        dest="reset",
        action="store_false",
        help="Keep existing chunks instead of resetting the collection",
    )
    parser.set_defaults(reset=True)
    args = parser.parse_args()

    print("Loading vector store (this loads the embedding model on first run)...")
    store = VectorStore()
    if args.reset:
        store.reset()
        print("Collection reset.")

    workspace_info = {"name": args.workspace_name, "area": args.area, "level": args.level}
    source_info = {"source_type": args.source_type, "title": args.title}

    if args.file:
        result = ingest_and_store(
            store,
            path=args.file,
            workspace_info=workspace_info,
            source_info=source_info,
            chunk_options=DEMO_CHUNK_OPTIONS,
        )
    else:
        result = ingest_and_store(
            store,
            text=SAMPLE_TEXT,
            workspace_info=workspace_info,
            source_info=source_info,
            chunk_options=DEMO_CHUNK_OPTIONS,
        )

    ws = result["record"]["workspace"]
    src = result["record"]["source"]
    print("\n" + "=" * 70)
    print("INGESTION + STORAGE")
    print("=" * 70)
    print(f"  source file_name : {src['file_name']}")
    print(f"  extraction status: {result['extraction']['status']}")
    print(f"  chunks stored    : {result['stored']}")
    print(f"  total in store   : {store.count_chunks()}")
    print(f"  in this workspace: {store.count_chunks(workspace_id=ws['workspace_id'])}")
    if result["record"]["warnings"]:
        print(f"  warnings         : {result['record']['warnings']}")

    results = store.search_chunks(
        args.query, workspace_id=ws["workspace_id"], top_k=args.top_k
    )
    _print_results(args.query, results)


if __name__ == "__main__":
    main()
