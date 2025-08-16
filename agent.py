#!/usr/bin/env python
# The Definitive, Two-Pass Intelligent Coding Agent

import os
import re
import sys
import json
import textwrap
import subprocess
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

# --- Configuration ---
MAX_EXECUTION_PASSES = 25
MODEL_NAME = "gemini-2.5-pro"  # Explicitly set as requested.
CONTEXT_IGNORE = {".git", ".venv", "node_modules", "__pycache__", ".agent", "dist", "build"}

# --- Logging & Safety ---
STATE_DIR = Path(".agent")
REPORTS_DIR = STATE_DIR / "reports"
LOCK_FILE = STATE_DIR / "run.lock"
os.makedirs(REPORTS_DIR, exist_ok=True)
log_file_path = REPORTS_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}.log"
log_file = open(log_file_path, "w", encoding="utf-8")

def log(message):
    log_message = f"[AGENT] {message}"
    print(log_message, flush=True)
    log_file.write(f"[{datetime.now().isoformat()}] {message}\n")
    log_file.flush()

# --- Tools ---
def run_command(command):
    log(f"🏃 Running command: {' '.join(command)}")
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False, encoding="utf-8")
        output = result.stdout.strip() + "\n" + result.stderr.strip()
        if result.returncode == 0:
            log("✅ Command successful.")
            return True, output
        else:
            log(f"❌ Command failed with exit code {result.returncode}.")
            log(f"   | Combined Output:\n{textwrap.indent(output.strip(), '   | ')}")
            return False, output
    except Exception as e:
        log(f"❌ Command failed with an exception: {e}")
        return False, str(e)

def get_file_tree():
    log("🌳 Getting repository file tree for the discovery pass...")
    ok, files = run_command(["git", "ls-files"])
    return files if ok else None

def get_repo_context(files_to_read):
    log(f"📚 Reading content for {len(files_to_read)} relevant files...")
    context = []
    for filename in files_to_read:
        path = Path(filename.strip())
        if any(part in CONTEXT_IGNORE for part in path.parts): continue
        try:
            content = path.read_text(encoding='utf-8', errors='ignore')
            context.append(f"----\n📄 {filename}\n----\n{content}")
        except Exception:
            context.append(f"----\n📄 {filename}\n----\n(could not read file)")
    log("✅ Specific file context built.")
    return "\n".join(context)

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
            log(f"❌ CRITICAL WRITE FAILURE for '{p.resolve()}': {e}"); return False
    return True

# --- Hard-coded Test Strategy ---
def get_test_commands():
    log("📋 Using hard-coded test plan from GitHub Actions workflow.")
    return [
        ["pnpm", "--dir", "app/desktop", "install", "--frozen-lockfile"],
        ["pnpm", "--dir", "app/desktop", "run", "build"]
    ]

# --- Agent Core Logic ---
def call_gemini_api(prompt, pass_type):
    log(f"🧠 Sending {pass_type} prompt to model '{MODEL_NAME}'...")
    try:
        model = genai.GenerativeModel(MODEL_NAME)
        response = model.generate_content(prompt)
        log("✅ API call successful.")
        return response
    except google_exceptions.ResourceExhausted as e:
        log(f"❌ API Error 429: Resource Exhausted. The prompt is too large. {e.message}")
        return None
    except google_exceptions.NotFoundError as e:
        log(f"❌ API Error: Model '{MODEL_NAME}' not found. {e.message}")
        return None
    except Exception as e:
        log(f"❌ An unexpected API error occurred: {e}")
        return None

def run_agent(goal):
    log("🚀 Agent starting...")
    load_dotenv(dotenv_path=Path(".agent/agent.env"), override=True)
    if not os.environ.get("GOOGLE_API_KEY"):
        log("❌ FATAL: GOOGLE_API_KEY not found."); sys.exit(1)
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
    log("✅ Environment and API key loaded.")

    # --- Pass 1: Discovery ---
    file_tree = get_file_tree()
    if not file_tree: sys.exit(1)
    
    discovery_prompt = textwrap.dedent(f"""
        You are a senior engineer. Based on the file tree below, list the full paths of files that are most relevant to read to solve the user's goal.
        List only the file paths, each on a new line. Do NOT provide any other commentary.
        ## File Tree
        {file_tree}
        ## User Goal
        {goal}
    """).strip()
    
    discovery_response = call_gemini_api(discovery_prompt, "Discovery")
    if not discovery_response or not hasattr(discovery_response, 'text') or not discovery_response.text.strip():
        log("❌ FATAL: Discovery pass failed to get a valid response."); sys.exit(1)
        
    relevant_files = discovery_response.text.strip().splitlines()
    log(f"✅ Discovery complete. Identified {len(relevant_files)} relevant files to read.")
    
    # --- Execution Loop ---
    relevant_context = get_repo_context(relevant_files)
    test_commands = get_test_commands()
    memory = ""
    
    for i in range(MAX_EXECUTION_PASSES):
        pass_num = i + 1
        log(f"--- 🔁 Starting Execution Pass {pass_num}/{MAX_EXECUTION_PASSES} ---")
        
        execution_prompt = textwrap.dedent(f"""
            You are an expert AI software engineer. Your response MUST include a `## Plan`, `EDIT` blocks, and a `## Summary of Changes`.
            {memory}
            ## Relevant File Content
            {relevant_context}
            ## User Goal
            {goal}
        """).strip()

        execution_response = call_gemini_api(execution_prompt, f"Execution Pass {pass_num}")
        
        if not execution_response or not hasattr(execution_response, 'text') or not execution_response.text.strip():
            log(f"⚠️ Pass {pass_num} failed: No valid response from API."); continue
        
        raw_text = execution_response.text
        log("--- 🤖 Gemini's Full Response ---")
        log(raw_text)
        log("---------------------------------")

        edit_blocks = re.findall(r"EDIT ([\w/.\-]+)\n```[\w]*\n(.*?)\n```", raw_text, re.DOTALL)
        if not edit_blocks:
            log(f"⚠️ Pass {pass_num} failed: Response was malformed (missing EDIT blocks).")
            memory = "## Memory\n**Critique:** Your last response was malformed. You MUST provide at least one `EDIT path/to/file.ext` command *before* its code block."
            continue
            
        if not apply_edits(edit_blocks): break

        log("🧪 Running validation tests...")
        tests_ok = True
        for cmd in test_commands:
            log(f"   | EXECUTING TEST: `{' '.join(cmd)}`")
            ok, output = run_command(cmd)
            if not ok:
                tests_ok = False
                log(f"   | ❌ TEST FAILED: `{' '.join(cmd)}`")
                memory = f"## Memory\n**Critique:** Your last code edit failed validation. The command `{' '.join(cmd)}` produced this error:\n---\n{output}\n---\nPlease provide a new fix."
                break
            else:
                log(f"   | ✅ TEST PASSED: `{' '.join(cmd)}`")

        if tests_ok:
            log("🎉 All tests passed! Agent finished successfully!")
            run_command(["git", "add", "."]); run_command(["git", "commit", "-m", f"feat(agent): Achieve goal '{goal[:40]}'"])
            break
        else:
            log(f"❌ Reverting changes from failed pass {pass_num}.")
            run_command(["git", "reset", "--hard", "HEAD"])

    else: log(f"❌ Max passes reached.")
    log("🛑 Agent shutting down.")
    LOCK_FILE.unlink()

if __name__ == "__main__":
    if not LOCK_FILE.exists():
        LOCK_FILE.touch()
        goal = sys.argv[1] if len(sys.argv) > 1 else ""
        if not goal:
            log("❌ FATAL: No goal provided.")
        else:
            run_agent(goal)
    else:
        print("🛑 Lock file exists. Another agent might be running.")
