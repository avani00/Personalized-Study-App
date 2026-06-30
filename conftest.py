"""Pytest configuration.

Ensures the project root is importable so tests can ``import extraction``
regardless of where pytest is invoked from.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
