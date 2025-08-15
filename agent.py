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
ALLOWED_EDIT = {""}
CONTEXT_IGNORE = {
    ".git", ".hg", ".svn", ".venv", "node_modules", "__pycache__",
    ".DS_Store", "*.pyc", "*.pyo", "*.so", ".next", "dist", "build",
    ".vscode-server", ".vscode-remote", ".ssh", ".local", ".turbo",
    ".cache", ".dotnet", ".agent", "pnpm-lock.yaml",
}
MAIN_BRANCH = "main"
MAX_PASSES = 6
PUSH_MAIN = os.environ.get("SHIP", "0") == "1"
CRON_MODE = os.environ.get("CRON", "0") == "1"
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
    """Prints to console and writes to the run's log file with emojis for clarity."""
    print(message, flush=True)
    log_file.write(f"[{datetime.datetime.now().isoformat()}] {message}\n")
    log_file.flush()

# --- Utility Functions ---
def run_command(command, check=True):
    """Runs a command and returns its output, logging everything."""
    log(f"🏃 Running command: {' '.join(command)}")
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
            log(f"   | stdout: {result.stdout.strip()}")
        if result.stderr:
            log(f"   | stderr: {result.stderr.strip()}")
        log(f"✅ Command successful: {' '.join(command)}")
        return True, result.stdout.strip()
    except subprocess.CalledProcessError as e:
        log(f"❌ Command failed with exit code {e.returncode}: {' '.join(command)}")
        if e.stdout:
            log(f"   | stdout: {e.stdout.strip()}")
        if e.stderr:
            log(f"   | stderr: {e.stderr.strip()}")
        return False, e.stderr.strip()
    except Exception as e:
        log(f"❌ Command failed with exception: {e}")
        return False, str(e)

def is_path_allowed(filepath: str, allowed_set: set) -> bool:
    """Checks if a file path is in the allowed set."""
    if "" in allowed_set:
        return True
    return any(filepath.startswith(prefix) for prefix in allowed_set)

def _save_summary(run_id, summary_text):
    """Saves a detailed summary to the main summary file."""
    try:
        with open(SUMMARY_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n\n---\n\n### Run ID: {run_id}\n\n{summary_text}")
    except Exception as e:
        log(f"⚠️ Could not write to summary file: {e}")

# --- Core Agent Logic ---
def get_repo_context():
    """Builds a string with file listings and contents for the prompt."""
    log("🔍 Building repository context...")
    context = []
    ok, files = run_command(["git", "ls-files"])
    if not ok:
        log("⚠️ Could not list git files. Falling back to os.walk.")
        files = [str(p) for p in Path().rglob("*") if p.is_file()]
    
    file_list = files.splitlines()
    log(f"   | Found {len(file_list)} files to analyze.")

    for filename in file_list:
        path = Path(filename)
        if any(part in CONTEXT_IGNORE for part in path.parts):
            continue
        
        context.append(f"----\n📄 {filename}\n----")
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
            context.append(content)
        except Exception:
            context.append("(could not read file content)")

    log("✅ Repository context built.")
    return "\n".join(context)

def run_tests():
    """Runs the project's test suite."""
    log("🧪 Running build and test gate...")
    
    # These commands are based on the logs provided. Adjust if necessary.
    ok, _ = run_command(["pnpm", "--dir", "app/desktop", "install"])
    if not ok: return False
    
    ok, _ = run_command(["pnpm", "--dir", "app/desktop", "run", "build"])
    if not ok: return False

    ok, _ = run_command(["pnpm", "--dir", "app/desktop", "run", "test:smoke"])
    if not ok: 
        log("❌ Smoke tests failed.")
        return False

    log("🟢 Build/test gate GREEN.")
    return True

def _process_response(response):
    """
    Parses Gemini's response, extracts the plan, and executes file edits.
    Returns (edits_applied, detailed_summary)
    """
    if not response or not response.text:
        log("❌ Received empty response from model.")
        return False, "Error: Empty response from model."

    text = response.text
    log("--- 🤖 Gemini's Full Response ---\n" + text + "\n---------------------------------")

    # Extract the plan for logging and summary
    plan_match = re.search(r"## Plan\n(.*?)(?=##|EDIT)", text, re.DOTALL)
    plan_text = plan_match.group(1).strip() if plan_match else "No plan was provided."
    
    summary_match = re.search(r"## Summary of Changes\n(.*?)$", text, re.DOTALL)
    summary_text = summary_match.group(1).strip() if summary_match else "No summary was provided."
    
    detailed_summary = f"**Agent's Plan:**\n{plan_text}\n\n**Agent's Summary:**\n{summary_text}"

    edit_blocks = re.findall(r"EDIT ([\w/.-]+)\n```[\w]*\n(.*?)\n```", text, re.DOTALL)
    
    if not edit_blocks:
        log("🤔 Agent provided a plan but no EDIT blocks. Retrying.")
        return False, detailed_summary

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
            return False, f"Failed to write to {filepath}.\n\n{detailed_summary}"

    if files_edited:
        return True, detailed_summary
    else:
        log("⚠️ No valid file edits were applied from the response.")
        return False, detailed_summary


def run_pass(run_id: str, user_prompt: str, passes_done: int):
    """Runs a single, more verbose pass of the agent."""
    log(f"--- 🔁 Starting Pass {passes_done}/{MAX_PASSES} ---")

    repo_context = get_repo_context()
    
    feedback_file = STATE_DIR / "feedback.txt"
    feedback_context = ""
    if feedback_file.exists():
        feedback_context = feedback_file.read_text(encoding="utf-8").strip()
        log(f"📝 Found feedback from previous run: {feedback_context}")

    # **CRITICAL CHANGE**: New, much more demanding prompt.
    prompt = textwrap.dedent(f"""
        You are an expert-level AI software engineer. Your task is to solve the user's request by editing files. You are methodical, careful, and you ALWAYS explain your reasoning.

        ## Instructions
        Your response MUST follow this exact structure. Do not deviate.

        1.  **PLAN:** Start with a `## Plan` section. Explain your understanding of the problem, the root cause, and your step-by-step strategy for the fix. Detail which files you will modify and why. This section is MANDATORY.

        2.  **CODE EDITS:** Provide the code edits using the `EDIT` block format. Ensure you provide the FULL, complete content for each file you edit. Do not use placeholders or omit code.
            
            EDIT path/to/file.ext
            ```language
            (new file content here)
            ```

        3.  **SUMMARY:** End with a `## Summary of Changes` section. Briefly describe the changes you made and how they solve the user's request. This section is MANDATORY.

        ## Repository Context
        {repo_context}

        ## Previous Run Feedback
        {feedback_context or "No feedback from previous run."}
        
        ## User Request
        {user_prompt}
    """).strip()

    if DRY_RUN:
        print("--- 🕵️ DRY RUN PROMPT ---")
        print(prompt)
        sys.exit(0)
    
    log("🧠 Sending prompt to Gemini. Awaiting response...")
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment.")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        
        token_count = model.count_tokens(prompt).total_tokens
        log(f"   | Token count for this pass: {token_count}")
        
        resp = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.05)
        )
    except Exception as e:
        log(f"❌ Gemini API call failed: {e}")
        return False, "Gemini API call failed."

    ok, summary = _process_response(resp)
    _save_summary(run_id, summary) # Always save the detailed summary
    return ok, summary

def main():
    """Main entry point for the agent."""
    log(f"🚀 Agent starting. Run ID: {run_id}")
    log(f"   | Logging to: {log_file_path}")

    if len(sys.argv) < 2:
        print("Usage: python agent.py \"<your request>\"")
        sys.exit(1)
    user_prompt = sys.argv[1]
    log(f"   | User Request: \"{user_prompt}\"")

    passes_done = 0
    while passes_done < MAX_PASSES:
        passes_done += 1
        
        edits_applied, summary = run_pass(run_id, user_prompt, passes_done)

        if edits_applied:
            log("✅ Edits applied. Proceeding to test gate.")
            
            if run_tests():
                log("✅ Tests passed! Committing changes.")
                run_command(["git", "add", "."])
                commit_message = f"feat(agent): solve '{user_prompt[:50]}...'\n\n{summary}\n\nRun ID: {run_id}"
                run_command(["git", "commit", "-m", commit_message])
                
                if PUSH_MAIN:
                    log(f"🚢 Pushing to {MAIN_BRANCH}...")
                    run_command(["git", "push", "origin", MAIN_BRANCH])
                
                log("🎉 Agent finished successfully!")
                break
            else:
                log("❌ Tests failed after applying edits. The agent's fix was incorrect. Will retry.")
                run_command(["git", "reset", "--hard", "HEAD"]) # Revert failed changes
        else:
            log(f"⚠️ Pass {passes_done} failed to produce a valid edit. Summary of attempt:\n{summary}")
    
    if passes_done >= MAX_PASSES:
        log("❌ Max passes reached. Agent stopping.")
    
    log_file.close()
    LOCK_FILE.unlink()
    log("🏁 Agent finished.")

if __name__ == "__main__":
    main()
