"""Automated tests for the Stage A extraction module.

Run from the project root with:

    pytest                # all tests
    pytest -v             # verbose
    pytest -k pdf         # only tests matching "pdf"

PDFs used here are generated on the fly with PyMuPDF, so there are no
external fixture files to manage. As new extraction features are added,
extend this file with matching tests.
"""

import pymupdf  # PyMuPDF (also importable as `fitz`)
import pytest

from extraction import (
    STATUS_ERROR,
    STATUS_NEEDS_OCR,
    STATUS_SUCCESS,
    STATUS_UNSUPPORTED,
    extract_file,
    extract_pasted_text,
    extract_pdf,
    extract_text_file,
)
from extraction.cleaning import clean_text

# Common schema keys every result must expose.
RESULT_KEYS = {"source_type", "file_name", "status", "pages", "warnings"}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _make_pdf(path, pages_text):
    """Create a simple digital PDF; one page per string in ``pages_text``.

    An empty/whitespace string produces a page with no text (useful for
    simulating a scanned/image page).
    """
    doc = pymupdf.open()
    for text in pages_text:
        page = doc.new_page()
        if text and text.strip():
            page.insert_text((72, 72), text, fontsize=12)
    doc.save(str(path))
    doc.close()


def _assert_valid_shape(result):
    """Every result must share the same top-level schema."""
    assert set(result.keys()) == RESULT_KEYS
    assert isinstance(result["pages"], list)
    assert isinstance(result["warnings"], list)
    for page in result["pages"]:
        assert set(page.keys()) == {"page_number", "text"}
        assert isinstance(page["text"], str)


# --------------------------------------------------------------------------- #
# clean_text
# --------------------------------------------------------------------------- #
def test_clean_text_empty():
    assert clean_text("") == ""
    assert clean_text(None) == ""


def test_clean_text_fixes_hyphenated_linebreaks():
    assert clean_text("recur-\nsion") == "recursion"
    # Tolerate stray spaces around the break.
    assert clean_text("recur- \n sion") == "recursion"


def test_clean_text_collapses_inline_spaces():
    assert clean_text("a    b\tc") == "a b c"


def test_clean_text_strips_each_line():
    assert clean_text("  hello  \n  world  ") == "hello\nworld"


def test_clean_text_collapses_repeated_blank_lines_but_keeps_paragraphs():
    cleaned = clean_text("para one\n\n\n\npara two")
    assert cleaned == "para one\n\npara two"


def test_clean_text_strips_leading_and_trailing_whitespace():
    assert clean_text("\n\n  content  \n\n") == "content"


# --------------------------------------------------------------------------- #
# pasted text
# --------------------------------------------------------------------------- #
def test_pasted_text_success():
    result = extract_pasted_text("Hello    world\n\n\nGoodbye")
    _assert_valid_shape(result)
    assert result["source_type"] == "pasted_text"
    assert result["file_name"] is None
    assert result["status"] == STATUS_SUCCESS
    assert len(result["pages"]) == 1
    assert result["pages"][0]["page_number"] is None
    assert result["pages"][0]["text"] == "Hello world\n\nGoodbye"


def test_pasted_text_empty_is_error():
    result = extract_pasted_text("    \n\n   ")
    _assert_valid_shape(result)
    assert result["status"] == STATUS_ERROR
    assert result["pages"] == []
    assert result["warnings"]


# --------------------------------------------------------------------------- #
# text files (.txt / .md)
# --------------------------------------------------------------------------- #
def test_text_file_md(tmp_path):
    f = tmp_path / "notes.md"
    f.write_text("# Title\n\n\nA base case stops recur-\nsion.\n\n\nDone.")
    result = extract_file(str(f))
    _assert_valid_shape(result)
    assert result["source_type"] == "text_file"
    assert result["file_name"] == "notes.md"
    assert result["status"] == STATUS_SUCCESS
    assert result["pages"][0]["page_number"] is None
    assert "recursion." in result["pages"][0]["text"]
    assert "\n\n\n" not in result["pages"][0]["text"]


def test_text_file_txt(tmp_path):
    f = tmp_path / "notes.txt"
    f.write_text("plain text content here")
    result = extract_text_file(str(f))
    assert result["status"] == STATUS_SUCCESS
    assert result["pages"][0]["text"] == "plain text content here"


def test_text_file_unsupported_extension(tmp_path):
    f = tmp_path / "data.csv"
    f.write_text("a,b,c")
    result = extract_file(str(f))
    _assert_valid_shape(result)
    assert result["status"] == STATUS_UNSUPPORTED


def test_text_file_latin1_does_not_crash(tmp_path):
    f = tmp_path / "weird.txt"
    # Bytes that are valid latin-1 but invalid UTF-8 (forces the fallback path).
    f.write_bytes(b"caf\xe9 r\xe9sum\xe9")
    result = extract_text_file(str(f))
    assert result["status"] == STATUS_SUCCESS
    assert result["pages"][0]["text"]


# --------------------------------------------------------------------------- #
# PDFs
# --------------------------------------------------------------------------- #
def test_pdf_single_page_success(tmp_path):
    f = tmp_path / "doc.pdf"
    _make_pdf(f, ["Recursion uses a base case to terminate the recursive calls."])
    result = extract_pdf(str(f))
    _assert_valid_shape(result)
    assert result["source_type"] == "pdf"
    assert result["file_name"] == "doc.pdf"
    assert result["status"] == STATUS_SUCCESS
    assert result["pages"][0]["page_number"] == 1
    assert "base case" in result["pages"][0]["text"]


def test_pdf_preserves_page_numbers(tmp_path):
    f = tmp_path / "multi.pdf"
    _make_pdf(
        f,
        [
            "Page one talks about recursion and base cases in detail here.",
            "Page two talks about iteration and loops and counters in detail.",
            "Page three covers dynamic programming and memoization techniques.",
        ],
    )
    result = extract_file(str(f))
    assert result["status"] == STATUS_SUCCESS
    assert [p["page_number"] for p in result["pages"]] == [1, 2, 3]


def test_pdf_with_no_text_needs_ocr(tmp_path):
    f = tmp_path / "scanned.pdf"
    _make_pdf(f, ["", ""])  # two blank pages -> no extractable text
    result = extract_pdf(str(f))
    _assert_valid_shape(result)
    assert result["status"] == STATUS_NEEDS_OCR
    assert any("scanned" in w.lower() for w in result["warnings"])


def test_corrupt_pdf_returns_error(tmp_path):
    f = tmp_path / "broken.pdf"
    f.write_bytes(b"this is definitely not a valid pdf file")
    result = extract_pdf(str(f))
    _assert_valid_shape(result)
    assert result["status"] == STATUS_ERROR
    assert result["warnings"]


# --------------------------------------------------------------------------- #
# extract_file dispatch / bad paths
# --------------------------------------------------------------------------- #
def test_missing_file_returns_error():
    result = extract_file("/no/such/path/file.txt")
    _assert_valid_shape(result)
    assert result["status"] == STATUS_ERROR


def test_directory_path_returns_error(tmp_path):
    result = extract_file(str(tmp_path))
    assert result["status"] == STATUS_ERROR


@pytest.mark.parametrize("ext", [".pdf", ".txt", ".md"])
def test_extract_file_routes_by_extension(tmp_path, ext):
    f = tmp_path / f"sample{ext}"
    if ext == ".pdf":
        _make_pdf(f, ["Routing check with enough text to be considered valid content."])
    else:
        f.write_text("routing check with enough text content here")
    result = extract_file(str(f))
    assert result["status"] == STATUS_SUCCESS
