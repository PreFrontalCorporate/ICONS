#!/usr/bin/env python
import os
from pathlib import Path
import datetime

print("--- Running Test 02: Log File Writing ---")
try:
    user = os.getlogin()
    cwd = Path.cwd()
    print(f"INFO: Running as user '{user}' in directory '{cwd}'")

    REPORTS_DIR = cwd / ".agent" / "reports"
    LOG_FILE = REPORTS_DIR / "test_log.txt"

    print(f"STEP: Ensuring reports directory exists at '{REPORTS_DIR.resolve()}'")
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"STEP: Attempting to write to log file at '{LOG_FILE.resolve()}'")
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write(f"Test log entry at {datetime.datetime.now().isoformat()}\n")
    print("SUCCESS: Log file written successfully.")

    print(f"STEP: Verifying content...")
    content = LOG_FILE.read_text(encoding="utf-8")
    print(f"   CONTENT: '{content.strip()}'")
    assert "Test log entry" in content
    print("SUCCESS: Content verified.")

    print("STEP: Attempting to delete log file.")
    LOG_FILE.unlink()
    print("SUCCESS: Log file deleted successfully.")

except PermissionError as e:
    print(f"\n❌ FAILED: A PermissionError occurred.")
    print(f"   DETAILS: {e}")
    print(f"   RECOMMENDATION: Check permissions for the '.agent/reports' directory.")
except Exception as e:
    print(f"\n❌ FAILED: An unexpected error occurred: {type(e).__name__}: {e}")

print("--- Test 02 Finished ---\n")
