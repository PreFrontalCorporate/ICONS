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
PUSH_MAIN = os.environ.get("AGENT_SHIP", "0") == "1"
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

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
    print(message, flush=True)
    log_file.write(f"[{datetime.datetime.now().isoformat()}] {message}\n")
    log_file.flush()

# --- Utilities ---
def run_command(command, check=True):
    log(f"🏃 Running command: {' '.join(command)}")
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=check, encoding="utf-8", errors="ignore")
        if result.stdout: log(f"   | stdout: {result.stdout.strip()}")
        if result.stderr: log(f"   | stderr: {result.stderr.strip()}")
        log(f"✅ Command successful: {' '.join(command)}")
        return True, result.stdout.strip()
    except subprocess.CalledProcessError as e:
        log(f"❌ Command failed with exit code {e.returncode}: {' '.join(command)}")
        if e.stdout: log(f"   | stdout: {e.stdout.strip()}")
        if e.stderr: log(f"   | stderr: {e.stderr.strip()}")
        return False, e.stderr.strip()
    except Exception as e:
        log(f"❌ Command failed with exception: {e}")
        return False, str(e)

def _save_summary(run_id, summary_text):
    try:
        with open(SUMMARY_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n\n---\n\n### Run ID: {run_id}\n\n{summary_text}")
    except Exception as e:
        log(f"⚠️ Could not write to summary file: {e}")

# --- Repo context ---
def get_repo_context():
    log("🔍 Building repository context...")
    context = []
    ok, files = run_command(["git", "ls-files"])
    if not ok:
        log("⚠️ Could not list git files. Falling back to os.walk.")
        files = [str(p) for p in Path().rglob("*") if p.is_file()]
    file_list = files.splitlines() if isinstance(files, str) else files
    log(f"   | Found {len(file_list)} files to analyze.")
    for filename in file_list:
        path = Path(filename)
        if any(part in CONTEXT_IGNORE for part in path.parts): 
            continue
        context.append(f"----\n📄 {filename}\n----")
        try:
            context.append(path.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            context.append("(could not read file content)")
    log("✅ Repository context built.")
    return "\n".join(context)

def run_tests():
    log("🧪 Running build and test gate...")
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

# --- Response handling ---
def _process_response(response):
    raw_text = response.text if response and response.text else ""
    if not raw_text:
        log("❌ Received empty response from model.")
        return False, "Error: Agent returned an empty response."

    log("--- 🤖 Gemini's Full Response ---\n" + raw_text + "\n---------------------------------")

    plan_match = re.search(r"## Plan\n(.*?)(?=##|EDIT)", raw_text, re.DOTALL)
    plan_text = plan_match.group(1).strip() if plan_match else "No plan was provided."
    summary_match = re.search(r"## Summary of Changes\n(.*?)$", raw_text, re.DOTALL)
    summary_text = summary_match.group(1).strip() if summary_match else "No summary was provided."
    detailed_summary = f"**Agent's Plan:**\n{plan_text}\n\n**Agent's Summary:**\n{summary_text}"

    edit_blocks = re.findall(r"EDIT ([\w/.\-]+)\n```[\w]*\n(.*?)\n```", raw_text, re.DOTALL)
    if not edit_blocks:
        log("🤔 Agent provided a plan but no EDIT blocks.")
        return False, detailed_summary

    files_edited = False
    for filepath, content in edit_blocks:
        filepath_str = filepath.strip()
        log(f"✍️ Attempting to write to file: {filepath_str}")
        try:
            p = Path(filepath_str)
            p.parent.mkdir(parents=True, exist_ok=True)
            if not os.access(p.parent, os.W_OK):
                log(f"⚠️ Directory {p.parent} not writable, attempting chmod...")
                run_command(["chmod", "u+w", str(p.parent)], check=False)
            if not os.access(p.parent, os.W_OK):
                raise PermissionError(f"Directory {p.parent} is still not writable.")
            p.write_text(content, encoding="utf-8")
            log(f"✅ Applied edit to {filepath_str}")
            files_edited = True
        except Exception as e:
            log(f"❌ CRITICAL WRITE FAILURE: {e}")
            return False, f"Permission error editing {filepath_str}: {e}\n\n{detailed_summary}"

    return files_edited, detailed_summary

# --- Main pass loop ---
def run_pass(run_id, user_prompt, passes_done):
    log(f"--- 🔁 Starting Pass {passes_done}/{MAX_PASSES} ---")
    repo_context = get_repo_context()
    prompt = textwrap.dedent(f"""
        You are an expert AI software engineer...
        ## Repository Context
        {repo_context}
        ## User Request
        {user_prompt}
    """).strip()

    if DRY_RUN:
        print(prompt)
        sys.exit(0)

    log("🧠 Sending prompt to Gemini...")
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key: raise ValueError("GOOGLE_API_KEY not found.")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        resp = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(temperature=0.05))
    except Exception as e:
        return False, f"Gemini API call failed: {e}"

    ok, summary = _process_response(resp)
    _save_summary(run_id, summary)
    return ok, summary

# --- Entry point ---
def main():
    log(f"🚀 Agent starting. Run ID: {run_id}")
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
                run_command(["git", "add", "."])
                commit_message = f"feat(agent): solve '{user_prompt[:50]}...'\n\n{summary}\n\nRun ID: {run_id}"
                run_command(["git", "commit", "-m", commit_message])
                if PUSH_MAIN:
                    run_command(["git", "push", "origin", MAIN_BRANCH])
                break
            else:
                run_command(["git", "reset", "--hard", "HEAD"])
    log_file.close()
    LOCK_FILE.unlink()

if __name__ == "__main__":
    main()
