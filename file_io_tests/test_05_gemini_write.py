#!/usr/bin/env python
import os
import re
from pathlib import Path
import google.generativeai as genai
import textwrap
from dotenv import load_dotenv

print("--- Running Test 05: Gemini API Direct Write Test ---")

# --- Configuration ---
TARGET_FILE_PATH = "app/desktop/src/main.ts"

try:
    # --- Setup ---
    user = os.getlogin()
    cwd = Path.cwd()
    print(f"INFO: Running as user '{user}' in directory '{cwd}'")
    
    # Load environment variables from .agent/agent.env
    env_path = cwd / ".agent" / "agent.env"
    if env_path.exists():
        print(f"INFO: Loading environment variables from '{env_path.resolve()}'")
        load_dotenv(dotenv_path=env_path)
    else:
        print(f"WARNING: Environment file not found at '{env_path.resolve()}'")

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("FATAL: GOOGLE_API_KEY not found after attempting to load .env file.")
    genai.configure(api_key=api_key)
    print("SUCCESS: Gemini API key found and configured.")

    # --- Model Call ---
    print("STEP: Creating a minimal prompt for the Gemini API.")
    prompt = "Reply with only the text 'Hello World'" # Simple test prompt

    print("STEP: Sending prompt to Gemini API...")
    model = genai.GenerativeModel('gemini-1.5-pro-latest')
    response = model.generate_content(prompt)
    raw_text = response.text
    print("SUCCESS: Received response from API.")
    
    # --- File Writing ---
    print("STEP: Simulating an EDIT block with the API response.")
    filepath = TARGET_FILE_PATH
    content = f"// Gemini API direct write test.\n// Response: {raw_text.strip()}\n"
    
    p = Path(filepath.strip())
    print(f"STEP: Attempting to write API response content to '{p.resolve()}'")
    p.parent.mkdir(parents=True, exist_ok=True)
    
    backup_content = p.read_bytes() if p.exists() else None
    p.write_text(content, encoding="utf-8")
    print(f"SUCCESS: Wrote {len(content)} characters from API to file.")
    
    if backup_content:
        print("STEP: Restoring original file content from backup.")
        p.write_bytes(backup_content)
        print("SUCCESS: File restored.")

except Exception as e:
    print(f"\n❌ FAILED: A critical error occurred during the Gemini write test.")
    print(f"   Error Type: {type(e).__name__}")
    print(f"   DETAILS: {e}")

print("--- Test 05 Finished ---\n")
