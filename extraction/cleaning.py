"""Basic text cleaning shared by all extraction sources.

The goal is light, non-destructive normalization — enough to make the text
consistent for later stages (chunking/embeddings) without altering meaning.
"""

import re

# Match a hyphenated line break like "exam-\nple" (optionally with spaces
# around the newline) so we can rejoin the split word.
_HYPHEN_LINEBREAK = re.compile(r"(\w)-[ \t]*\n[ \t]*(\w)")
# 2+ spaces/tabs in a row (within a line).
_INLINE_SPACES = re.compile(r"[ \t]{2,}")
# 3+ newlines = more than one blank line.
_REPEATED_BLANKS = re.compile(r"\n{3,}")


def clean_text(text):
    """Apply basic cleaning to a block of text.

    - normalize whitespace and line endings
    - fix hyphenated line breaks (``exam-\\nple`` -> ``example``)
    - strip leading/trailing spaces on each line
    - collapse repeated blank lines (preserving single paragraph breaks)
    """
    if not text:
        return ""

    # Normalize line endings.
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Normalize non-breaking spaces and tabs to regular spaces.
    text = text.replace("\u00a0", " ").replace("\t", " ")

    # Rejoin words split across a line by a hyphen.
    text = _HYPHEN_LINEBREAK.sub(r"\1\2", text)

    # Per-line: collapse runs of spaces/tabs and trim the ends.
    lines = [_INLINE_SPACES.sub(" ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)

    # Collapse multiple blank lines into a single blank line (keep paragraphs).
    text = _REPEATED_BLANKS.sub("\n\n", text)

    return text.strip()
