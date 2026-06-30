#!/usr/bin/env python3
"""Simple CLI to exercise the Stage A extraction module.

Examples:
    # A PDF
    python test_extraction.py --file path/to/notes.pdf

    # A .txt or .md file
    python test_extraction.py --file path/to/notes.md

    # Pasted text passed on the command line
    python test_extraction.py --text "some pasted study text"

    # Pasted text piped in via stdin
    cat notes.txt | python test_extraction.py --stdin

Add --preview N to truncate each page's text to N characters in the printout.
"""

import argparse
import json
import sys

from extraction import extract_file, extract_pasted_text


def main():
    parser = argparse.ArgumentParser(
        description="Stage A document extraction test harness.",
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
        help="Truncate each page's text to N characters in the printout",
    )
    args = parser.parse_args()

    if args.file:
        result = extract_file(args.file)
    elif args.stdin:
        result = extract_pasted_text(sys.stdin.read())
    else:
        result = extract_pasted_text(args.text)

    if args.preview is not None:
        for page in result["pages"]:
            text = page["text"]
            if len(text) > args.preview:
                hidden = len(text) - args.preview
                page["text"] = text[: args.preview] + f"... [+{hidden} more chars]"

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
