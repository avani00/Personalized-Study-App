#!/usr/bin/env python3
"""Simple CLI to exercise the Stage A extraction + v1 metadata modules.

Examples:
    # A PDF
    python test_extraction.py --file path/to/notes.pdf

    # A .txt or .md file
    python test_extraction.py --file path/to/notes.md

    # Pasted text passed on the command line
    python test_extraction.py --text "some pasted study text"

    # Pasted text piped in via stdin
    cat notes.txt | python test_extraction.py --stdin

    # Wrap the extracted text in the v1 ingestion record (workspace/source/chunks)
    python test_extraction.py --file notes.pdf --ingest \
        --workspace-name "15-251" --area computer_science --level undergraduate \
        --source-type lecture_notes --title "Lecture 3: Induction"

Add --preview N to truncate long text in the printout.
"""

import argparse
import json
import sys

from extraction import extract_file, extract_pasted_text, ingest_extraction


def _truncate_pages(pages, limit):
    for page in pages:
        text = page["text"]
        if len(text) > limit:
            page["text"] = text[:limit] + f"... [+{len(text) - limit} more chars]"


def main():
    parser = argparse.ArgumentParser(
        description="Stage A document extraction + metadata test harness.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--file", help="Path to a .pdf, .txt, or .md file")
    source.add_argument("--text", help="Pasted text to extract/clean")
    source.add_argument(
        "--stdin", action="store_true", help="Read pasted text from standard input"
    )
    parser.add_argument(
        "--preview",
        type=int,
        default=None,
        metavar="N",
        help="Truncate long text to N characters in the printout",
    )

    # v1 metadata options (all optional; defaults are applied if omitted).
    parser.add_argument(
        "--ingest",
        action="store_true",
        help="Wrap the extracted text in the v1 ingestion record",
    )
    parser.add_argument("--workspace-name", help="Workspace name")
    parser.add_argument("--area", help="Workspace subject area, e.g. computer_science")
    parser.add_argument("--level", help="Workspace level, e.g. undergraduate")
    parser.add_argument("--source-type", help="Source type, e.g. lecture_notes")
    parser.add_argument("--title", help="Source title")
    parser.add_argument("--author", help="Source author")

    args = parser.parse_args()

    if args.file:
        result = extract_file(args.file)
    elif args.stdin:
        result = extract_pasted_text(sys.stdin.read())
    else:
        result = extract_pasted_text(args.text)

    if not args.ingest:
        if args.preview is not None:
            _truncate_pages(result["pages"], args.preview)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    workspace_info = {
        "name": args.workspace_name,
        "area": args.area,
        "level": args.level,
    }
    source_info = {
        "source_type": args.source_type,
        "title": args.title,
        "author": args.author,
    }
    record = ingest_extraction(
        result, workspace_info=workspace_info, source_info=source_info
    )

    if args.preview is not None:
        _truncate_pages(record["chunks"], args.preview)

    print(json.dumps(record, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
