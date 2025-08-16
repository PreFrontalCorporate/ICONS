#!/usr/bin/env python
import os
from pathlib import Path

print("--- Running Test 03: Reading Repo File ---")
# This test assumes a file like 'agent.py' exists in the root.
TARGET_FILE = "agent.py"

try:
    user = os.getlogin()
    cwd = Path.cwd()
    print(f"INFO: Running as user '{user}' in directory '{cwd}'")

    file_to_read = cwd / TARGET_FILE
    print(f"STEP: Attempting to read file at '{file_to_read.resolve()}'")

    if not file_to_read.exists():
        raise FileNotFoundError(f"Target file '{TARGET_FILE}' not found in root directory.")

    content = file_to_read.read_text(encoding="utf-8", errors="ignore")
    print(f"SUCCESS: Read {len(content)} characters from the file.")
    
    # Corrected line: The replacement is done outside the f-string expression
    snippet = content[:100].replace('\n', ' ')
    print(f"   SNIPPET: '{snippet}...'")

except FileNotFoundError as e:
    print(f"\n❌ FAILED: {e}")
except Exception as e:
    print(f"\n❌ FAILED: An unexpected error occurred: {type(e).__name__}: {e}")

print("--- Test 03 Finished ---\n")
