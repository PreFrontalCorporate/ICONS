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
def _process_response(response, dry_run=False):
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
        
        if dry_run:
            log(f"DRY RUN: Skipping write to {filepath_str}")
            continue # Skip to the next file block

        log(f"✍️ Attempting to write to file: {filepath_str}")
        try:
            p = Path(filepath_str)
            p.parent.mkdir(parents=True, exist_ok=True)
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
        You are an expert-level AI software engineer. Your task is to solve the user's request by editing files. You are methodical, careful, and you ALWAYS explain your reasoning.

        ## Instructions
        Your response MUST follow this exact structure. Do not deviate.

        1.  **PLAN:** Start with a `## Plan` section. Explain your understanding of the problem and your step-by-step strategy. This section is MANDATORY.

        2.  **CODE EDITS:** If you can fix the code, provide edits using the `EDIT` block format. Ensure you provide the FULL, complete content for each file you edit.
            
            EDIT path/to/file.ext
            ```language
            (new file content here)
            ```

        3.  **SUMMARY:** End with a `## Summary of Changes` section. Describe the changes you made. This section is MANDATORY.

        **IMPORTANT**: If you determine you cannot edit files due to an environment error (like 'write_not_allowed' from an internal tool), your plan MUST state this as the primary obstacle. Your summary MUST explain that you were blocked and could not proceed.

        ## Repository Context
        {repo_context}
        
        ## User Request
        {user_prompt}
    """).strip()

    log("🧠 Sending prompt to Gemini...")
    try:
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key: raise ValueError("GOOGLE_API_KEY not found.")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-pro-latest')
        resp = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(temperature=0.05))
    except Exception as e:
        return False, f"Gemini API call failed: {e}"

    # Pass the DRY_RUN flag to the processing function
    ok, summary = _process_response(resp, dry_run=DRY_RUN)
    _save_summary(run_id, summary)
    return ok, summary

# --- Entry point ---
def main():
    log(f"🚀 Agent starting. Run ID: {run_id}")
    if len(sys.argv) < 2:
        print("Usage: python agent.py \"<your request>\"")
        sys.exit(1)
    user_prompt = sys.argv[1]

    # Handle the new DRY_RUN logic at the start
    if DRY_RUN:
        log("🕵️ DRY RUN — will query Gemini and show the plan, but will not edit files.")
        _, summary = run_pass(run_id, user_prompt, 1)
        print("\n" + "="*20 + " AGENT DRY RUN SUMMARY " + "="*20)
        print(summary)
        print("="*63)
        log_file.close()
        LOCK_FILE.unlink()
        sys.exit(0)

    passes_done = 0
    while passes_done < MAX_PASSES:
        passes_done += 1
        edits_applied, summary = run_pass(run_id, user_prompt, passes_done)
        if edits_applied:
            if run_tests():
                log("✅ Tests passed! Committing changes.")
                run_command(["git", "add", "."])
                commit_message = f"feat(agent): solve '{user_prompt[:50]}...'\n\n{summary}\n\nRun ID: {run_id}"
                run_command(["git", "commit", "-m", commit_message])
                if PUSH_MAIN:
                    run_command(["git", "push", "origin", MAIN_BRANCH])
                log("🎉 Agent finished successfully!")
                break
            else:
                log("❌ Tests failed. Reverting changes and retrying.")
                run_command(["git", "reset", "--hard", "HEAD"])
        else:
            log(f"⚠️ Pass {passes_done} did not apply any edits. Reason:\n{summary}")

    if passes_done >= MAX_PASSES:
        log("❌ Max passes reached. Agent stopping.")
        
    log_file.close()
    LOCK_FILE.unlink()

if __name__ == "__main__":
    main()
