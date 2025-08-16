#!/usr/bin/env python3
"""
dump_repo.py – Traverse the project tree rooted at this script’s directory and
write a human–readable dump of every directory, file name and file contents
into repo_structure.txt (created next to this script).

Usage:
    python3 dump_repo.py
"""

from pathlib import Path
import os
import sys

# --------------------------------------------------------------------------- #
# Configuration – edit to taste
# --------------------------------------------------------------------------- #
# Relative directory names to ignore at any depth.  Feel free to add/remove.
EXCLUDE_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "node_modules",
    "__pycache__",
}
# Name of the output file created next to this script.
OUTPUT_FILENAME = "repo.txt"
# --------------------------------------------------------------------------- #


def should_skip_dir(dir_name: str) -> bool:
    """Return True if directory should be skipped."""
    return dir_name in EXCLUDE_DIRS


def dump_repository(root: Path) -> str:
    """Return a string containing folder/file tree plus file contents."""
    pieces: list[str] = []

    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        # filter directories in‑place so os.walk doesn't descend into them
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]

        rel_dir = Path(dirpath).relative_to(root)
        folder_header = f"/{rel_dir}/" if rel_dir != Path(".") else "/"
        pieces.append("=" * 30)
        pieces.append(folder_header)
        pieces.append("=" * 30)

        for filename in sorted(filenames):
            file_path = Path(dirpath) / filename
            rel_file = file_path.relative_to(root)
            pieces.append("=" * 30)
            pieces.append(f"/{rel_file}")
            pieces.append("=" * 30)
            try:
                # Attempt text read; fall back to binary size notice
                content = file_path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, ValueError):
                # Binary or non‑UTF‑8 file
                size = file_path.stat().st_size
                content = f"[binary file – {size} bytes]"
            pieces.append(content)
            pieces.append("=" * 30)

    return "\n".join(pieces)


def main() -> None:
    repo_root = Path(__file__).resolve().parent
    save_path = repo_root / OUTPUT_FILENAME

    # Ensure parent directory exists (defensive – it should already)
    save_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"🔍 Scanning repository at {repo_root} ...", file=sys.stderr)
    dump_text = dump_repository(repo_root)

    save_path.write_text(dump_text, encoding="utf-8")
    print(f"✅ Repository structure written to {save_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
