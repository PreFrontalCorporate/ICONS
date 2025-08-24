#!/usr/bin/env python
# The Definitive, Production-Ready Intelligent Coding Agent

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
MODEL_NAME = "gemini-2.5-pro"
CONTEXT_IGNORE = {".git", ".venv", "node_modules", "__pycache__", ".agent", "dist", "build"}
AUTO_PUSH = True # SET TO TRUE TO AUTOMATICALLY PUSH CHANGES AND TAGS

# --- Logging & Safety ---
STATE_DIR = Path(".agent")
SUMMARIES_DIR = STATE_DIR / "summaries"
REPORTS_DIR = STATE_DIR / "reports"
LOCK_FILE = STATE_DIR / "run.lock"
os.makedirs(SUMMARIES_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)
log_file_path = REPORTS_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}.log"
log_file = open(log_file_path, "w", encoding="utf-8")

def log(message):
    """Logs a message to both the console and a file."""
    log_message = f"[AGENT] {message}"
    print(log_message, flush=True)
    log_file.write(f"[{datetime.now().isoformat()}] {message}\n")
    log_file.flush()

# --- Tools ---
def run_command(command):
    """Runs a shell command and returns its output, logging everything."""
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
    """Gets the list of all files in the repository for the discovery pass."""
    log("🌳 Getting repository file tree...")
    ok, files = run_command(["git", "ls-files"])
    return files if ok else None

def get_repo_context(files_to_read):
    """Gathers the context for a specific list of files."""
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
    """Applies a list of file edits to the filesystem."""
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
    """Returns the specific, hard-coded build and test commands for this project."""
    log("📋 Using the hard-coded test plan based on the GitHub Actions workflow.")
    return [
        ["pnpm", "--dir", "app/desktop", "install", "--frozen-lockfile"],
        ["pnpm", "--dir", "app/desktop", "run", "build"]
    ]

# --- Agent Core Logic ---
def call_gemini_api(prompt, pass_type):
    """Handles the call to the Gemini API with specific error handling."""
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

def perform_release_steps(goal, summary):
    """Bumps the version, commits, tags, and optionally pushes the release."""
    log("📦 Starting automated release process...")
    try:
        # 1. Add all changed files to staging first
        run_command(["git", "add", "."])

        # 2. Read and bump version in package.json
        pkg_path = Path("app/desktop/package.json")
        pkg_data = json.loads(pkg_path.read_text())
        old_version = pkg_data["version"]
        major, minor, patch = map(int, old_version.split('.'))
        new_version = f"{major}.{minor}.{patch + 1}"
        pkg_data["version"] = new_version
        pkg_path.write_text(json.dumps(pkg_data, indent=2) + "\n")
        log(f"   | Version bumped from {old_version} to {new_version}")

        # 3. Commit changes (including version bump)
        commit_message = f"feat(agent): {goal[:45]}\n\n{summary}\n\nrelease-version: {new_version}"
        run_command(["git", "add", "app/desktop/package.json"])
        run_command(["git", "commit", "-m", commit_message])

        # 4. Create Git tag
        tag_name = f"v{new_version}"
        run_command(["git", "tag", tag_name])
        log(f"   | Created Git tag: {tag_name}")
        
        # 5. Conditionally push to remote
        if AUTO_PUSH:
            log("🚀 Auto-push enabled. Pushing changes and tags to remote...")
            run_command(["git", "push"])
            run_command(["git", "push", "--tags"])
            log("✅ Push complete. GitHub Actions should be triggered.")
        else:
            log("✅ Release steps completed. Manual push required.")
            log(f"   | To publish and trigger the GitHub Action, run: git push && git push --tags")
        
        return new_version, commit_message
    except Exception as e:
        log(f"❌ An error occurred during the release process: {e}")
        return None, None

def create_run_summary(goal, final_plan, commit_message, recommendations):
    """Creates a detailed markdown summary of the agent's run."""
    log("📝 Creating run summary file...")
    summary_path = SUMMARIES_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-summary.md"
    
    _, diff = run_command(["git", "show", "HEAD"])

    summary_content = textwrap.dedent(f"""
    # Agent Run Summary

    **Goal:** {goal}

    ---

    ## Final Plan Executed
    {final_plan}

    ---

    ## AI Recommendations for Next Steps
    {recommendations}

    ---

    ## Git Commit Message
    ```
    {commit_message}
    ```

    ---

    ## Code Diff
    ```diff
    {diff}
    ```
    """)
    summary_path.write_text(summary_content)
    log(f"✅ Summary saved to: {summary_path.resolve()}")

def get_recommendations(goal, final_plan):
    """Performs a reflection pass to get recommendations for the next steps."""
    log("🤔 Performing reflection pass to get recommendations...")
    prompt = textwrap.dedent(f"""
        You are a senior project manager AI. A development task has just been successfully completed.
        Based on the original goal and the final implementation plan, what are the 2-3 most logical next steps for this project?
        Provide a concise, bulleted list.

        ## Original Goal
        {goal}

        ## Final Implementation Plan
        {final_plan}
    """).strip()
    response = call_gemini_api(prompt, "Reflection")
    if response and hasattr(response, 'text'):
        return response.text.strip()
    return "Could not generate recommendations."

def run_agent(goal):
    """The main execution loop for the agent."""
    log("🚀 Agent starting...")
    load_dotenv(dotenv_path=Path(".agent/agent.env"), override=True)
    if not os.environ.get("GOOGLE_API_KEY"):
        log("❌ FATAL: GOOGLE_API_KEY not found."); sys.exit(1)
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
    log("✅ Environment and API key loaded.")

    # Pass 1: Discovery
    file_tree = get_file_tree()
    if not file_tree: sys.exit(1)
    
    discovery_prompt = textwrap.dedent(f"""
        Based on the file tree below, list the full paths of files that are most relevant to the user's goal.
        List only file paths, each on a new line.
        ## File Tree
        {file_tree}
        ## User Goal
        {goal}
    """).strip()
    
    discovery_response = call_gemini_api(discovery_prompt, "Discovery")
    if not discovery_response or not hasattr(discovery_response, 'text') or not discovery_response.text.strip():
        log("❌ FATAL: Discovery pass failed."); sys.exit(1)
        
    relevant_files = discovery_response.text.strip().splitlines()
    log(f"✅ Discovery complete. Identified {len(relevant_files)} relevant files.")
    
    # Execution Loop
    relevant_context = get_repo_context(relevant_files)
    test_commands = get_test_commands()
    memory = ""
    
    for i in range(MAX_EXECUTION_PASSES):
        pass_num = i + 1
        log(f"--- 🔁 Starting Execution Pass {pass_num}/{MAX_EXECUTION_PASSES} ---")
        
        execution_prompt = textwrap.dedent(f"""
            Your response MUST include a `## Plan`, `EDIT` blocks, and a `## Summary of Changes`.
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
            log(f"⚠️ Pass {pass_num} failed: Malformed response (missing EDIT blocks).")
            memory = "## Memory\n**Critique:** Your last response was malformed. You MUST provide at least one `EDIT path/to/file.ext` command *before* its code block."
            continue
            
        if not apply_edits(edit_blocks): break

        log("🧪 Running validation tests...")
        tests_ok = True
        for cmd in test_commands:
            ok, output = run_command(cmd)
            if not ok:
                tests_ok = False
                memory = f"## Memory\n**Critique:** Your last edit failed validation. The command `{' '.join(cmd)}` produced this error:\n---\n{output}\n---\nPlease provide a new fix."
                break
        
        if tests_ok:
            log("🎉 All tests passed! Moving to release phase.")
            final_plan = re.search(r"## Plan\n(.*?)(?=##|EDIT)", raw_text, re.DOTALL).group(1).strip()
            final_summary = re.search(r"## Summary of Changes\n(.*?)$", raw_text, re.DOTALL).group(1).strip()
            
            recommendations = get_recommendations(goal, final_plan)
            _, commit_message = perform_release_steps(goal, final_summary)
            create_run_summary(goal, final_plan, commit_message, recommendations)
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
