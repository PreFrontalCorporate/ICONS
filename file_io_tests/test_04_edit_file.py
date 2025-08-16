#!/usr/bin/env python
import os
from pathlib import Path

print("--- Running Test 04: Editing Target File ---")
# This is the most important test. It simulates the agent's edit process.
TARGET_FILE_PATH = "app/desktop/src/main.ts"
TEST_CONTENT = "// Standalone file edit test by Gemini agent\nconsole.log('test');\n"

try:
    user = os.getlogin()
    cwd = Path.cwd()
    print(f"INFO: Running as user '{user}' in directory '{cwd}'")

    p = Path(TARGET_FILE_PATH)
    print(f"STEP: Target file is '{TARGET_FILE_PATH}'")
    print(f"   Absolute path will be: {p.resolve()}")

    print(f"STEP: Ensuring parent directory '{p.parent.resolve()}' exists.")
    p.parent.mkdir(parents=True, exist_ok=True)
    print("   Parent directory exists.")

    backup_content = None
    if p.exists():
        print(f"STEP: File exists. Reading content for backup.")
        backup_content = p.read_bytes() # Read as bytes to be safe
        print(f"   Backed up {len(backup_content)} bytes.")
        print(f"STEP: Deleting existing file (unlink).")
        p.unlink()
        print("   File deleted.")
    else:
        print("INFO: Target file does not exist, will create it.")

    print(f"STEP: Writing new content to '{p.resolve()}'.")
    p.write_text(TEST_CONTENT, encoding="utf-8")
    print(f"   Wrote {len(TEST_CONTENT)} characters.")
    print("SUCCESS: File written successfully.")

    # Restore from backup
    if backup_content:
        print("\nSTEP: Restoring file from backup.")
        p.write_bytes(backup_content)
        print("SUCCESS: File restored.")
    else:
        # If the file didn't exist before, clean it up.
        print("\nSTEP: Cleaning up created test file.")
        p.unlink()
        print("SUCCESS: Test file cleaned up.")

except PermissionError as e:
    print(f"\n❌ FAILED: A PermissionError occurred.")
    print(f"   DETAILS: {e}")
    print(f"   RECOMMENDATION: This is the critical failure point. The user '{user}' does not have permission to write/delete the file at '{p.resolve()}'. You MUST fix the filesystem permissions for this path.")
except Exception as e:
    print(f"\n❌ FAILED: An unexpected error occurred: {type(e).__name__}: {e}")

print("--- Test 04 Finished ---\n")
