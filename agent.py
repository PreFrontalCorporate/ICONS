#!/usr/bin/env python
# Gemini-powered coding agent
#
# Usage:
# 1. Fill in your API key in .agent/agent.env
# 2. Run from repo root:
#    ( set -a; source .agent/agent.env; set +a; \
#      ./.venv/bin/python agent.py "your request" )
#
# To run in ship mode (includes git push):
#    SHIP=1 ./agent.py "your request"
#
# To run on a schedule (e.g., via cron):
#    CRON=1 ./agent.py "your request"
#
# To see a dry run of the prompt:
#    DRY_RUN=1 ./agent.py "your request"

import google.generativeai as genai
import subprocess
import textwrap
import datetime
import shutil
import sys
import os
import re

from pathlib import Path

# --- Configuration ---

# To allow editing all files, use {""}.
# This is now the default to grant the agent full access.
ALLOWED_EDIT = {""}

# Files and folders to ignore when building context.
CONTEXT_IGNORE = {
    ".git", ".hg", ".svn", ".venv", "node_modules", "__pycache__",
    ".DS_Store", "*.pyc", "*.pyo", "*.so", ".next", "dist", "build",
    ".vscode-server", ".vscode-remote", ".ssh", ".local", ".turbo",
    ".cache", ".dotnet", ".agent", "pnpm-lock.yaml",
}

# Name of the main git branch
MAIN_BRANCH = "main"

# Max passes for the agent to attempt to solve the problem
MAX_PASSES = 6

# Set to 1 to run in ship mode (will push to main)
PUSH_MAIN = os.environ.get("SHIP", "0") == "1"

# Set to 1 for cron mode (quieter, exits on fail)
CRON_MODE = os.environ.get("CRON", "0") == "1"

# Set to 1 to see the prompt and exit
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

# --- Constants ---
STATE_DIR = Path(".agent")
REPORTS_DIR = STATE_DIR / "reports"
LOCK_FILE = STATE_DIR / "run.lock"
SUMMARY_FILE = STATE_DIR / "summary.md"
DEFAULT_PROMPT_FILE = STATE_DIR / "prompt.txt"
ENV_FILE = STATE_DIR / "agent.env"

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
    """Prints to console and writes to the run's log file."""
    print(message, flush=True)
    log_file.write(f"[{datetime.datetime.now().isoformat()}] {message}\n")
    log_file.flush()

# --- Utility Functions ---
def run_command(command, check=True):
    """Runs a command and returns its output."""
    log(f"🏃 running: {' '.join(command)}")
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=check,
            encoding="utf-8",
            errors="ignore",
        )
        if result.stdout:
            log(result.stdout)
        if result.stderr:
            log(result.stderr)
        return True, result.stdout.strip()
    except subprocess.CalledProcessError as e:
        log(f"❌ command failed with exit code {e.returncode}")
        log(e.stderr)
        return False, e.stderr.strip()
    except Exception as e:
        log(f"❌ command failed with exception: {e}")
        return False, str(e)

def is_path_allowed(filepath: str, allowed_set: set) -> bool:
    """Checks if a file path is in the allowed set."""
    if "" in allowed_set:
        return True
    return any(filepath.startswith(prefix) for prefix in allowed_set)

def _save_summary(run_id, summary_text):
    """Saves the summary to the main summary file."""
    try:
        with open(SUMMARY_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n\n---\n\n### Run ID: {run_id}\n\n{summary_text}")
    except Exception as e:
        log(f"⚠️ could not write to summary file: {e}")

# --- Core Agent Logic ---
def get_repo_context():
    """Builds a string with file listings and contents for the prompt."""
    context = []
    
    # Use git to list all tracked files, which respects .gitignore
    ok, files = run_command(["git", "ls-files"])
    if not ok:
        log("⚠️ Could not list git files. Falling back to os.walk.")
        files = [str(p) for p in Path().rglob("*") if p.is_file()]
    
    file_list = files.splitlines()

    for filename in file_list:
        path = Path(filename)
        if any(part in CONTEXT_IGNORE for part in path.parts):
            continue
        
        context.append(f"----\n📄 {filename}\n----")
        try:
            # Only include content of text files
            content = path.read_text(encoding="utf-8", errors="ignore")
            context.append(content)
        except Exception:
            context.append("(could not read file content)")

    return "\n".join(context)

def _process_response(response):
    """Parses Gemini's response and executes the commands."""
    if not response or not response.text:
        return False, "Empty response from model."

    text = response.text
    log("--- 🤖 Gemini's response ---\n" + text + "\n--------------------------")

    # Regex to find all EDIT blocks
    edit_blocks = re.findall(r"EDIT ([\w/.-]+)\n```[\w]*\n(.*?)\n```", text, re.DOTALL)
    
    if not edit_blocks:
        log("🤔 No EDIT blocks found in the response. Nothing to apply.")
        # **FIX**: Return False if no edits are proposed to prevent empty commits.
        return False, "No file edits were suggested by the agent."

    files_edited = False
    for filepath, content in edit_blocks:
        filepath = filepath.strip()
        if not is_path_allowed(filepath, ALLOWED_EDIT):
            log(f"❌ Agent tried to edit a forbidden file: {filepath}")
            continue

        try:
            p = Path(filepath)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
            log(f"✅ Applied edit to {filepath}")
            files_edited = True
        except Exception as e:
            log(f"❌ Failed to write to {filepath}: {e}")
            return False, f"Failed to write to {filepath}"

    # **FIX**: Only return True if at least one file was successfully edited.
    if files_edited:
        return True, "Edits applied successfully."
    else:
        return False, "No valid edits were applied."


def run_pass(run_id: str, user_prompt: str, passes_done: int):
    """Runs a single pass of the agent."""
    log(f"🔁 pass {passes_done}/{MAX_PASSES}")

    # --- Build the prompt ---
    repo_context = get_repo_context()
    
    # Check for feedback file
    feedback_file = STATE_DIR / "feedback.txt"
    feedback_context = ""
    if feedback_file.exists():
        feedback_context = feedback_file.read_text(encoding="utf-8").strip()
        log(f"📝 Found feedback: {feedback_context}")

    prompt = textwrap.dedent(f"""
        You are an expert software engineer AI agent. Your goal is to solve the user's request by editing files in the repository.

        ## Instructions
        1.  Analyze the user's request and the provided repository context.
        2.  Think step-by-step about how to solve the problem.
        3.  Output your plan and then the necessary file edits.
        4.  To edit a file, use the format:
            EDIT path/to/file.ext
            ```language
            (new file content here)
            ```
        5.  You can edit multiple files. Ensure you provide the FULL, complete content for each file you edit. Do not use placeholders.
        6.  If you don't need to edit any files, explain why.

        ## Repository Context
        {repo_context}

        ## Previous Run Feedback
        {feedback_context or "No feedback from previous run."}
        
        ## User Request
        {user_prompt}
    """).strip()

    if DRY_RUN:
        print("--- DRY RUN PROMPT---")
        print(prompt)
        sys.exit(0)

    # --- Call Gemini ---
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment.")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        
        token_count = model.count_tokens(prompt).total_tokens
        log(f"🧮 Token count: {token_count}")
        
        resp = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1, # Lower temperature for more deterministic code output
            )
        )
    except Exception as e:
        log(f"❌ Gemini API call failed: {e}")
        return False, "Gemini API call failed."

    # --- Execute Gemini's response ---
    ok, result = _process_response(resp)
    
    # Save the summary text regardless of success
    _save_summary(run_id, resp.text or "(no summary text)")
    
    return ok, result

def main():
    """Main entry point for the agent."""
    log(f"🧾 per-run logging enabled: {log_file_path}")

    if len(sys.argv) < 2:
        print("Usage: python agent.py \"<your request>\"")
        sys.exit(1)
    user_prompt = sys.argv[1]

    passes_done = 0
    while passes_done < MAX_PASSES:
        passes_done += 1
        
        ok, result = run_pass(run_id, user_prompt, passes_done)

        if ok:
            log("✅ Pass successful. Committing changes.")
            
            # Commit changes
            run_command(["git", "add", "."])
            commit_message = f"feat(agent): solve '{user_prompt[:50]}...'\n\nRun ID: {run_id}"
            run_command(["git", "commit", "-m", commit_message])
            
            if PUSH_MAIN:
                log(f"🚢 Pushing to {MAIN_BRANCH}...")
                run_command(["git", "push", "origin", MAIN_BRANCH])
            
            log("🎉 Agent finished successfully!")
            break  # Exit loop on success
        else:
            log(f"⚠️ Pass failed: {result}")
            if passes_done >= MAX_PASSES:
                log("❌ Max passes reached. Agent stopping.")
                break
            log("Retrying...")
    
    # Cleanup
    log_file.close()
    LOCK_FILE.unlink()

if __name__ == "__main__":
    main()
