#!/usr/bin/env python3
"""End-to-end demo of the Stage A pipeline: extract -> v1 ingestion record.

Run it with no arguments to exercise the built-in samples (pasted text and a
generated .md file). Optionally pass one or more file paths (.pdf/.txt/.md) to
ingest your own material too:

    python demo_ingest.py
    python demo_ingest.py /path/to/notes.pdf /path/to/syllabus.md

For every input it:
  1. extracts + cleans the text,
  2. wraps it in a Workspace / Source / Chunk ingestion record,
  3. prints a short human-readable summary, and
  4. saves the full JSON to ./output/<name>.json so you can inspect it.

Smaller chunk sizes are used here than the production defaults (500/50) so the
sample text visibly splits into multiple chunks.
"""

import json
import os
import sys

from extraction import extract_file, extract_pasted_text, ingest_extraction

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")

# Small chunks so the demo text splits into several pieces.
DEMO_CHUNK_OPTIONS = {"chunk_size": 60, "overlap": 10}

SAMPLE_PASTED_TEXT = """Induction Notes

Mathematical induction is a proof technique used to prove that a statement
P(n) holds for every natural number n. A proof by induction has two parts.

The base case shows that P(0) (or P(1)) is true. The inductive step shows
that if P(k) is true for some natural number k, then P(k+1) is also true.
Together these establish that P(n) is true for all n.

Strong induction is a variant where the inductive step may assume P(0)
through P(k), not just P(k). It is logically equivalent to ordinary
induction but is sometimes more convenient.

A common mistake is forgetting the base case. Without it, the inductive
step alone proves nothing, since the chain of implications has nothing to
start from. Always state the base case explicitly and verify it.
"""

SAMPLE_MD = """# Chapter 4: Recursion

A recursive function calls itself to solve smaller instances of a problem.

## Base Case
A base case stops the recursion. Without a base case, a recursive function
would call itself forever and overflow the call stack.

## Recursive Case
Each recursive call should move toward the base case, typically by reducing
the size of the input. The call stack tracks the pending calls.
"""


def _save(name, record):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f"{name}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(record, fh, indent=2, ensure_ascii=False)
    return path


def _print_summary(label, record):
    ws = record["workspace"]
    src = record["source"]
    chunks = record["chunks"]
    print("=" * 70)
    print(f"INPUT: {label}")
    print("-" * 70)
    print(f"  workspace.name   : {ws['name']}")
    print(f"  workspace.area   : {ws['area']}")
    print(f"  workspace.level  : {ws['level']}")
    print(f"  source.title     : {src['title']}")
    print(f"  source.type      : {src['source_type']}")
    print(f"  source.file      : {src['file_name']}  ({src['file_type']})")
    print(f"  number of chunks : {len(chunks)}")
    if chunks:
        first = chunks[0]
        print(f"  chunk[0] index   : {first['chunk_index']}")
        print(f"  chunk[0] tokens  : {first['token_count']}")
        print(f"  chunk[0] copied  : source_type={first['source_type']} area={first['area']}")
        preview = first["text"][:160].replace("\n", " ")
        print(f"  chunk[0] preview : {preview}{'...' if len(first['text']) > 160 else ''}")
    if record["warnings"]:
        print(f"  warnings         : {record['warnings']}")


def run_demo():
    cases = []

    # 1) Built-in pasted text.
    pasted = extract_pasted_text(SAMPLE_PASTED_TEXT)
    cases.append(
        (
            "pasted_text",
            "Pasted text sample",
            ingest_extraction(
                pasted,
                workspace_info={
                    "name": "15-251 Theoretical Computer Science",
                    "area": "computer_science",
                    "level": "undergraduate",
                },
                source_info={"source_type": "personal_notes", "title": "Induction Notes"},
                chunk_options=DEMO_CHUNK_OPTIONS,
            ),
        )
    )

    # 2) Built-in markdown file (written to the output dir, then ingested).
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    md_path = os.path.join(OUTPUT_DIR, "sample_chapter4.md")
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write(SAMPLE_MD)
    md_extracted = extract_file(md_path)
    cases.append(
        (
            "markdown_file",
            f"Markdown file ({os.path.basename(md_path)})",
            ingest_extraction(
                md_extracted,
                workspace_info={"name": "Intro CS", "area": "computer_science", "level": "high_school"},
                source_info={"source_type": "textbook", "title": "Chapter 4: Recursion"},
                chunk_options=DEMO_CHUNK_OPTIONS,
            ),
        )
    )

    # 3) Any file paths passed on the command line (e.g. a real PDF).
    for i, path in enumerate(sys.argv[1:]):
        extracted = extract_file(path)
        cases.append(
            (
                f"input_{i}_{os.path.splitext(os.path.basename(path))[0]}",
                f"User file ({os.path.basename(path)})",
                ingest_extraction(extracted, chunk_options=DEMO_CHUNK_OPTIONS),
            )
        )

    saved = []
    for name, label, record in cases:
        _print_summary(label, record)
        path = _save(name, record)
        saved.append(path)
        print(f"  saved JSON       : {path}")

    print("=" * 70)
    print(f"Done. {len(saved)} ingestion record(s) saved under: {OUTPUT_DIR}")


if __name__ == "__main__":
    run_demo()
