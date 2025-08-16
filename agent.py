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
CONTEXT_IGNORE = {
    ".git", ".hg", ".svn", ".venv", "node_modules", "__pycache__",
    ".DS_Store", "*.pyc", "*.pyo", "*.so", ".next", "dist", "build",
    ".vscode-server", ".vscode-remote", ".ssh", ".local", ".turbo",
    ".cache", ".dotnet", ".agent", "pnpm-lock.yaml",
}
MAIN_BRANCH = "main"
MAX_PASSES = 6
PUSH_MAIN = os.environ.get("AGENT_SHIP", "0") == "1"
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
IS_VERBOSE = os.environ.get("AGENT_VERBOSE", "0") == "1"

# --- Constants ---
STATE_DIR = Path(".agent")
REPORTS_DIR = STATE_DIR / "reports"
LOCK_FILE = STATE_DIR / "run.lock"
SUMMARY_FILE = STATE_DIR / "summary.md"

# --- Setup ---
os.makedirs(REPORTS_DIR, exist_ok=True)
if LOCK_FILE.exists():
    print(f"🛑 Lock file {LOCK_FILE} exists. Another agent might be running.")
    sys.exit(1)
LOCK_FILE.touch()

# --- Logging ---
run_id = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
log_filename_safe_prompt = re.sub(r'[^a-zA-Z0-9]+', '-', sys.argv[1][:40]) if len(sys.argv) > 1 else "no-prompt"
log_file_path = REPORTS_DIR / f"{run_id}-ship{int(PUSH_MAIN)}-{log_filename_safe_prompt}.full.log"
log_file = open(log_file_path, "w", encoding="utf-8")

def log(message):
    """Logs a message to both the console and the log file with a prefix."""
    log_message = f"[AGENT] {message}"
    print(log_message, flush=True)
    log_file.write(f"[{datetime.datetime.now().isoformat()}] {message}\n")
    log_file.flush()

# --- Utilities ---
def run_command(command, check=True):
    log(f"🏃 Running command: {' '.join(command)}")
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=check, encoding="utf-8", errors="ignore")
        # Always log stdout and stderr for complete transparency, even if empty.
        log(f"   | stdout: {result.stdout.strip()}")
        log(f"   | stderr: {result.stderr.strip()}")
        if check and result.returncode != 0:
             log(f"❌ Command failed with exit code {result.returncode}: {' '.join(command)}")
             return False, result.stderr.strip()
        log(f"✅ Command successful: {' '.join(command)}")
        return True, result.stdout.strip()
    except Exception as e:
        log(f"❌ Command failed with an unexpected exception: {e}")
        return False, str(e)

# --- Repo context ---
def get_repo_context():
    log("🔍 Building repository context...")
    context = []
    ok, files = run_command(["git", "ls-files"])
    if not ok:
        log("⚠️ 'git ls-files' failed. Falling back to scanning all files.")
        files = [str(p) for p in Path().rglob("*") if p.is_file()]
    
    file_list = files.splitlines() if isinstance(files, str) else files
    log(f"   | Found {len(file_list)} total files. Filtering...")
    
    for filename in file_list:
        path = Path(filename)
        if any(part in CONTEXT_IGNORE for part in path.parts):
            continue
        context.append(f"----\n📄 {filename}\n----")
        try:
            context.append(path.read_text(encoding="utf-8", errors="ignore"))
        except Exception as e:
            log(f"   | -> ⚠️  Could not read '{filename}': {e}")
            context.append("(could not read file content)")

    log("✅ Repository context built.")
    return "\n".join(context)

def run_tests():
    log("🧪 Running build and test gate...")
    ok, _ = run_command(["pnpm", "--dir", "app/desktop", "install"])
    if not ok: return False
    ok, _ = run_command(["pnpm", "--dir", "app/desktop", "run", "build"])
    if not ok: return False
    ok, _ = run_command(["pnpm", "--dir", "app/desktop", "run", "postbuild"])
    if not ok: return False
    log("🟢 Build/test gate GREEN.")
    return True

# --- Response handling ---
def _process_response(response, dry_run=False):
    log("🔎 Inspecting full model response object...")
    log(f"   | Full Candidate [0]: {response.candidates[0]}")

    raw_text = response.text if response and hasattr(response, 'text') else ""
    if not raw_text:
        log("❌ CRITICAL: Received empty response from model.")
        return False, "Error: Agent returned an empty response."

    log("--- 🤖 Gemini's Full Response (as processed text) ---")
    log(raw_text)
    log("----------------------------------------------------")

    edit_blocks = re.findall(r"EDIT ([\w/.\-]+)\n```[\w]*\n(.*?)\n```", raw_text, re.DOTALL)
    if not edit_blocks:
        log("🤔 Agent provided a plan but no EDIT blocks were found.")
        return False, "No valid EDIT blocks found in the response."

    for filepath, content in edit_blocks:
        filepath_str = filepath.strip()
        
        if dry_run:
            log(f"DRY RUN: Skipping write to '{filepath_str}'")
            continue

        log(f"✍️ Applying edit to file: '{filepath_str}'")
        try:
            p = Path(filepath_str)
            log(f"   | -> Absolute path: {p.resolve()}")
            p.parent.mkdir(parents=True, exist_ok=True)

            if p.exists():
                p.unlink()
                log("   | -> Removed existing file.")
            
            p.write_text(content, encoding="utf-8")
            log(f"   | -> Wrote {len(content)} characters.")
            log(f"✅ Applied edit to '{filepath_str}' successfully.")
        except Exception as e:
            log(f"❌ CRITICAL WRITE FAILURE for '{p.resolve()}': {e}")
            return False, f"FATAL: Error writing to '{filepath_str}': {e}"

    return True, "Successfully applied all edits."

# --- Main pass loop ---
def run_pass(run_id, user_prompt, passes_done):
    log(f"--- 🔁 Starting Pass {passes_done}/{MAX_PASSES} ---")
    repo_context = get_repo_context()
    prompt = textwrap.dedent(f"""
        You are an expert-level AI software engineer. Your task is to solve the user's request by editing files.
        ## Instructions
        - Your response MUST follow this exact structure: A short `## Plan`, `EDIT` blocks for changes, and a `## Summary of Changes`.
        - Provide FULL, complete content for each file you edit.
        
        ## Repository Context
        {repo_context}
        
        ## User Request
        {user_prompt}
    """).strip()

    if IS_VERBOSE:
        log("--- 🧠 Prompt to be sent to Gemini ---")
        log(prompt)
        log("--------------------------------------")

    try:
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        resp = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(temperature=0.0))
    except Exception as e:
        log(f"❌ Gemini API call failed: {e}")
        return False, f"Gemini API call failed: {e}"

    return _process_response(resp, dry_run=DRY_RUN)

# --- Entry point ---
def main():
    log(f"🚀 Agent starting. Run ID: {run_id}")
    
    # --- Robust Environment Loading (from our successful tests) ---
    env_path = Path(".agent/agent.env")
    log(f"STEP: Searching for environment file at '{env_path.resolve()}'")
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
        log("SUCCESS: Environment file loaded.")
    else:
        log("WARNING: '.agent/agent.env' not found. Relying on system environment variables.")

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        log("❌ FATAL: GOOGLE_API_KEY not found. Please ensure it is in '.agent/agent.env' or your system environment.")
        sys.exit(1)
    genai.configure(api_key=api_key)
    log("SUCCESS: Gemini API key configured.")
    # --- End of Environment Loading ---

    if len(sys.argv) < 2:
        print("Usage: python agent.py \"<your request>\"")
        sys.exit(1)
    user_prompt = sys.argv[1]

    passes_done = 0
    while passes_done < MAX_PASSES:
        passes_done += 1
        edits_applied, summary = run_pass(run_id, user_prompt, passes_done)
        
        if edits_applied:
            if run_tests():
                log("🎉 Agent finished successfully!")
                break
            else:
                log("❌ Tests failed after applying edits. Reverting changes.")
                run_command(["git", "reset", "--hard", "HEAD"], check=False)
        else:
            log(f"⚠️ Pass {passes_done} did not apply edits. Reason: {summary}")
            if "FATAL" in summary:
                break
    
    log("🛑 Agent shutting down.")
    LOCK_FILE.unlink()

if __name__ == "__main__":
    main()
