#!/usr/bin/env python
import os
from pathlib import Path

print("--- Running Test 01: Lock File Creation ---")

try:
    user = os.getlogin()
    cwd = Path.cwd()
    print(f"INFO: Running as user '{user}' in directory '{cwd}'")

    STATE_DIR = cwd / ".agent"
    LOCK_FILE = STATE_DIR / "run.lock"

    print(f"STEP: Ensuring state directory exists at '{STATE_DIR.resolve()}'")
    STATE_DIR.mkdir(exist_ok=True)

    print(f"STEP: Attempting to create lock file at '{LOCK_FILE.resolve()}'")
    LOCK_FILE.touch()
    print("SUCCESS: Lock file created successfully.")

    print("STEP: Attempting to delete lock file.")
    LOCK_FILE.unlink()
    print("SUCCESS: Lock file deleted successfully.")

except PermissionError as e:
    print(f"\n❌ FAILED: A PermissionError occurred.")
    print(f"   DETAILS: {e}")
    print(f"   RECOMMENDATION: Check permissions for the '.agent' directory.")
except Exception as e:
    print(f"\n❌ FAILED: An unexpected error occurred: {type(e).__name__}: {e}")

print("--- Test 01 Finished ---\n")
