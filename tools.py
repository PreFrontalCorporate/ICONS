#!/usr/bin/env python
# tools.py - A collection of utility functions for the agent.

import subprocess
from pathlib import Path

CONTEXT_IGNORE = {".git", ".venv", "node_modules", "__pycache__", ".agent", "dist", "build"}

def log(message):
    print(f"[AGENT] {message}", flush=True)

def run_command(command):
    log(f"🏃 Running command: {' '.join(command)}")
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True, encoding="utf-8", errors="ignore")
        log(f"   | stdout: {result.stdout.strip()}")
        log(f"   | stderr: {result.stderr.strip()}")
        log("✅ Command successful.")
        return True, result.stdout.strip()
    except Exception as e:
        log(f"❌ Command failed: {e}")
        return False, str(e)

def get_file_tree():
    """Gets the list of all files in the repository."""
    log("🌳 Getting repository file tree...")
    ok, files = run_command(["git", "ls-files"])
    if not ok:
        return None
    return files

def get_repo_context(files_to_read):
    """Gathers the context for a specific list of files."""
    log(f"📚 Reading content for {len(files_to_read)} files...")
    context = []
    for filename in files_to_read:
        path = Path(filename.strip())
        if any(part in CONTEXT_IGNORE for part in path.parts):
            continue
        try:
            content = path.read_text(encoding='utf-8', errors='ignore')
            context.append(f"----\n📄 {filename}\n----\n{content}")
        except Exception as e:
            context.append(f"----\n📄 {filename}\n----\n(could not read file: {e})")
    log("✅ Specific file context built.")
    return "\n".join(context)

def get_git_history():
    log("📜 Reading recent Git history...")
    ok, history = run_command(["git", "log", "-n", "5", "--pretty=format:%h - %s (%cr)"])
    if not ok: return "Could not read git history."
    return history

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
            return False
    log("✅ All edits applied successfully.")
    return True
