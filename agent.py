#!/usr/bin/env python
# Gemini-powered coding agent

import google.generativeai as genai
import subprocess
import textwrap
import datetime
import sys
import os
import re
from pathlib import Path
from dotenv import load_dotenv

# --- Configuration ---
CONTEXT_IGNORE = {".git", ".venv", "node_modules", "__pycache__", ".agent"}
MAX_PASSES = 10
IS_VERBOSE = os.environ.get("AGENT_VERBOSE", "0") == "1"

# --- Constants ---
STATE_DIR = Path(".agent")
REPORTS_DIR = STATE_DIR / "reports"
LOCK_FILE = STATE_DIR / "run.lock"

# --- Setup ---
os.makedirs(REPORTS_DIR, exist_ok=True)
if LOCK_FILE.exists():
    print(f"🛑 Lock file {LOCK_FILE} exists. Another agent might be running.")
    sys.exit(1)
LOCK_FILE.touch()

# --- Logging ---
log_file_path = REPORTS_DIR / f"{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.log"
log_file = open(log_file_path, "w", encoding="utf-8")

def log(message):
    log_message = f"[AGENT] {message}"
    print(log_message, flush=True)
    log_file.write(f"[{datetime.datetime.now().isoformat()}] {message}\n")
    log_file.flush()

# --- Utilities ---
def run_command(command, check=True):
    log(f"🏃 Running command: {' '.join(command)}")
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=check, encoding="utf-8", errors="ignore")
        log(f"   | stdout: {result.stdout.strip()}")
        log(f"   | stderr: {result.stderr.strip()}")
        if check and result.returncode != 0:
             log(f"❌ Command failed with exit code {result.returncode}")
             return False, result.stderr.strip()
        log(f"✅ Command successful.")
        return True, result.stdout.strip()
    except Exception as e:
        log(f"❌ Command failed with exception: {e}")
        return False, str(e)

# --- Core Logic ---
def get_repo_context():
    log("🔍 Building repository context...")
    context = []
    # Use 'git ls-files' as the primary method for accuracy
    ok, files = run_command(["git", "ls-files"])
    if not ok:
        log("⚠️ 'git ls-files' failed. Falling back to directory scan.")
        # Fallback to scanning all files if git is not available or fails
        files = [str(p) for p in Path().rglob("*") if p.is_file() and not any(part in CONTEXT_IGNORE for part in p.parts)]
    
    file_list = files.splitlines() if isinstance(files, str) else files
    for filename in file_list:
        try:
            context.append(f"----\n📄 {filename}\n----\n{Path(filename).read_text(encoding='utf-8', errors='ignore')}")
        except Exception as e:
            context.append(f"----\n📄 {filename}\n----\n(could not read file: {e})")
    log("✅ Repository context built.")
    return "\n".join(context)

def run_tests():
    log("🧪 Running build and test gate...")
    commands = [
        ["pnpm", "--dir", "app/desktop", "install"],
        ["pnpm", "--dir", "app/desktop", "run", "build"],
        ["pnpm", "--dir", "app/desktop", "run", "postbuild"]
    ]
    for cmd in commands:
        ok, _ = run_command(cmd)
        if not ok:
            log(f"❌ Test gate failed at step: {' '.join(cmd)}")
            return False
    log("🟢 Build/test gate GREEN.")
    return True

def process_response(response):
    log("🔎 Processing Gemini's response...")
    raw_text = response.text if response and hasattr(response, 'text') else ""
    if not raw_text:
        log("❌ CRITICAL: Received empty response from model.")
        return {"error": "Empty response from model."}
    
    if IS_VERBOSE:
        log("--- 🤖 Gemini's Full Response ---")
        log(raw_text)
        log("---------------------------------")
    
    summary_match = re.search(r"## Summary of Changes\n(.*?)$", raw_text, re.DOTALL)
    edit_blocks = re.findall(r"EDIT ([\w/.\-]+)\n```[\w]*\n(.*?)\n```", raw_text, re.DOTALL)

    if not summary_match or not summary_match.group(1).strip():
        return {"error": "Response was missing a '## Summary of Changes' section."}
    if not edit_blocks:
        return {"error": "Response did not contain any valid 'EDIT' blocks."}

    log("✅ Response processed successfully.")
    return {"summary": summary_match.group(1).strip(), "edits": edit_blocks}

def apply_edits(edits):
    log("✍️ Applying edits to filesystem...")
    for filepath, content in edits:
        try:
            p = Path(filepath.strip())
            p.parent.mkdir(parents=True, exist_ok=True)
            if p.exists(): p.unlink()
            p.write_text(content, encoding="utf-8")
            log(f"   | ✅ Wrote {len(content)} chars to {p.resolve()}")
        except Exception as e:
            log(f"❌ CRITICAL WRITE FAILURE for '{p.resolve()}': {e}")
            return False, f"FATAL: Error writing to '{p.resolve()}': {e}"
    log("✅ All edits applied successfully.")
    return True, "Edits applied."

def run_pass(user_prompt, memory):
    repo_context = get_repo_context()
    prompt = textwrap.dedent(f"""
        You are an expert-level AI software engineer. Your task is to solve the user's request by editing files.
        ## Instructions
        - Your response MUST include a `## Plan`, `EDIT` blocks for changes, and a `## Summary of Changes`.
        - Provide the FULL, complete content for each file you edit.
        
        {memory}

        ## Repository Context
        {repo_context}
        
        ## User Request
        {user_prompt}
    """).strip()
    
    if IS_VERBOSE:
        log("--- 🧠 Prompt to be sent to Gemini ---")
        log(prompt)
        log("--------------------------------------")
    else:
        log("🧠 Sending prompt to Gemini...")

    try:
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        return model.generate_content(prompt, generation_config=genai.types.GenerationConfig(temperature=0.0))
    except Exception as e:
        log(f"❌ Gemini API call failed: {e}")
        return None

def main():
    log("🚀 Agent starting...")
    
    env_path = Path(".agent/agent.env")
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
        log(f"✅ Environment file loaded from '{env_path.resolve()}'")

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        log("❌ FATAL: GOOGLE_API_KEY not found.")
        sys.exit(1)
    genai.configure(api_key=api_key)
    log("✅ Gemini API key configured.")

    user_prompt = sys.argv[1] if len(sys.argv) > 1 else ""
    if not user_prompt:
        log("❌ FATAL: No user prompt provided. Usage: python agent.py \"<your request>\"")
        sys.exit(1)

    pass_count = 0
    memory_string = ""
    while pass_count < MAX_PASSES:
        pass_count += 1
        log(f"--- 🔁 Starting Pass {pass_count}/{MAX_PASSES} ---")
        
        response = run_pass(user_prompt, memory_string)
        if not response:
            memory_string = f"## Memory\nThe previous attempt failed due to an API call error. Please try again."
            continue

        processed_data = process_response(response)
        if "error" in processed_data:
            log(f"⚠️ Pass failed: {processed_data['error']}")
            memory_string = f"## Memory\nYour last response was invalid: '{processed_data['error']}'. Please re-read the instructions carefully and try again."
            continue

        ok, message = apply_edits(processed_data["edits"])
        if not ok:
            log(f"⚠️ Pass failed: {message}")
            memory_string = f"## Memory\nThe last attempt failed with a critical file write error: '{message}'. This is an environment issue. Please state this in your summary and do not provide an EDIT block."
            continue

        if run_tests():
            log("🎉 Agent finished successfully!")
            break
        else:
            log("❌ Tests failed. Reverting changes and preparing for the next attempt.")
            run_command(["git", "reset", "--hard", "HEAD"], check=False)
            memory_string = f"## Memory\nYour last code edit was correctly applied, but the test suite failed. Please analyze the code and the context again to propose a different solution."

    if pass_count >= MAX_PASSES:
        log(f"❌ Max passes ({MAX_PASSES}) reached. Agent stopping.")
        
    log("🛑 Agent shutting down.")
    LOCK_FILE.unlink()

if __name__ == "__main__":
    main()
