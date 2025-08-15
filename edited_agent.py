# /srv/icon/agent.py  (v7.4: reports per run, tracked-only reverts, ship gating, 429 backoff, pinned smoke path)
import os, sys, json, subprocess, time, re, shlex
from pathlib import Path
from typing import Optional, Dict, Any, List

import fcntl
import requests

from google import genai
from google.genai import types

AGENT_VERSION = "7.4"

PROJECT_DIR = Path("/srv/icon").resolve()
APP_DIR = PROJECT_DIR / "app" / "desktop"
STATE_DIR = PROJECT_DIR / ".agent"
LOG_PATH = STATE_DIR / "agent.log"
FEEDBACK_PATH = Path(os.environ.get("AGENT_FEEDBACK_FILE", str(STATE_DIR / "feedback.txt")))
STATE_DIR.mkdir(exist_ok=True)

# per-run reporting
REPORTS_DIR = STATE_DIR / "reports"
REPORTS_DIR.mkdir(exist_ok=True)
RUN_LOG_FILE: Optional[Path] = None  # set per-run

def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    # mirror into the per-run log if enabled
    if RUN_LOG_FILE is not None:
        try:
            with RUN_LOG_FILE.open("a", encoding="utf-8") as rf:
                rf.write(line + "\n")
        except Exception:
            pass

# ---------------- Env flags ----------------
SHIP = os.environ.get("AGENT_SHIP", "0") == "1"
PUSH_MAIN = os.environ.get("AGENT_PUSH_MAIN", "1") == "1"  # default push to main when shipping
REVERT_ON_FAIL = os.environ.get("AGENT_REVERT_ON_FAIL", "1") == "1"
INCLUDE_LOCKFILE = os.environ.get("AGENT_INCLUDE_LOCKFILE", "1") == "1"
BRANCH = os.environ.get("AGENT_BRANCH", "agent/sticker-fix-128")
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
MAX_CALLS = int(os.environ.get("AGENT_MAX_REMOTE_CALLS", "300"))

# token budgets
TOKEN_BUDGET = int(os.environ.get("AGENT_TOKEN_BUDGET", "900000"))
TOKEN_MARGIN = int(os.environ.get("AGENT_TOKEN_MARGIN", "50000"))

# file/tool caps
MAX_READ_BYTES = int(os.environ.get("AGENT_MAX_READ_BYTES", "200000"))
LISTDIR_MAX = int(os.environ.get("AGENT_LISTDIR_MAX", "800"))

# pass loop controls (0 = unlimited)
MAX_PASSES = int(os.environ.get("AGENT_MAX_PASSES", "6"))
SLEEP_BETWEEN_PASSES = int(os.environ.get("AGENT_SLEEP_BETWEEN_PASSES", "4"))

# smoke pin
PIN_SMOKE = os.environ.get("AGENT_PIN_SMOKE", "1") == "1"

# GitHub check
GITHUB_REPO = os.environ.get("GITHUB_REPO", "").strip()
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_CHECK = os.environ.get("AGENT_CHECK_GH", "1") == "1"
GITHUB_FALLBACK_REF = os.environ.get("AGENT_GITHUB_REF_FALLBACK", "main")

# ---------------- Allowed writes ----------------
ALLOWED_EDIT = {
    "",
}

# ---------------- PINNED SMOKE (Node + jsdom + electron stubs) ----------------
PINNED_SMOKE = r"""/* scripts/smoke-sticker-bridge.js (pinned) */
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// --- stub minimal DOM + window ---
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!doctype html><html><body><img id="st" src="https://icon-web-two.vercel.app/test.png"/></body></html>`, {
  url: "https://icon-web-two.vercel.app/"
});
global.window = dom.window;
global.document = dom.window.document;

// --- stub electron bridge ---
const events = [];
const ipcRenderer = {
  sendToHost: (channel, payload) => {
    console.log("ipcRenderer.sendToHost called with:", channel, payload);
    events.push([channel, payload]);
  }
};
const contextBridge = {
  exposeInMainWorld: (name, bridge) => {
    global[name] = bridge;
  }
};
// make require('electron') return the stubs
const Module = require('node:module');
const origLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron') return { ipcRenderer, contextBridge };
  return origLoad.apply(this, arguments);
};

// --- load preload script in a VM ---
const preloadPath = path.join(__dirname, '..', 'windows', 'webview-preload.js');
const code = fs.readFileSync(preloadPath, 'utf8');
const sandbox = {
  console, require, module, __filename, __dirname,
  window: global.window, document: global.document
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// one ready + one sticker
console.log("Running smoke test...");
const ready = events.filter(e => e[0] === 'icon:webview-ready').length;
assert.strictEqual(ready, 1, "expected one ready");

const img = document.getElementById('st');
const click = new dom.window.MouseEvent('click', { button: 0, bubbles: true, cancelable: true });
img.dispatchEvent(click);

const stickers = events.filter(e => e[0] === 'icon:webview-sticker').length;
assert.strictEqual(stickers, 1, "expected one sticker");

console.log("✅ smoke passed");
"""

# ---------------- Allowed commands ----------------
BASE_ALLOWED_CMDS = (
    "pnpm --dir app/desktop install",
    "pnpm --dir app/desktop run build",
    "pnpm --dir app/desktop run postbuild",
    "pnpm --dir app/desktop run test:smoke",
    "pnpm --dir app/desktop run build:main",
    "pnpm --dir app/desktop run build:preload",
    "pnpm --dir app/desktop run build:renderer",
    "git status",
    "git status --porcelain",
    "git pull --rebase",
    "git pull --rebase origin ",
    "git checkout ",
    "git checkout -b ",
    "git add ",
    "git commit -m ",
    "git rev-parse ",
    "git ls-remote ",
    "git ls-files ",
    "npm pkg set version=",
    "git reset --hard HEAD^",
    "git checkout -- ",
)
SHIP_ONLY_CMDS = (
    "git push origin ",
    "git tag -a ",
    "git push --tags",
    "git tag -d ",
)

def _allowed_cmd(cmd: str) -> bool:
    cmd = cmd.strip()
    allowed = list(BASE_ALLOWED_CMDS)
    if SHIP:
        allowed += SHIP_ONLY_CMDS
    return any(cmd.startswith(prefix) for prefix in allowed)

def _safe_path(rel: str) -> Path:
    p = (PROJECT_DIR / rel).resolve()
    if not str(p).startswith(str(PROJECT_DIR)):
        raise ValueError("Path escapes project dir")
    return p

def _allowed_file(rel: str) -> bool:
    return rel.replace("\\", "/") in ALLOWED_EDIT

# ---------------- Token helpers ----------------
def _rough_tokens(text: str) -> int:
    return max(1, len(text) // 4)

def _shrink_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars: return text
    half = max_chars // 2
    return text[:half] + "\n...\n" + text[-half:]

def _count_tokens(client: genai.Client, model: str, system_text: str, user_text: str) -> int:
    try:
        combined = f"[SYSTEM]\n{system_text}\n[USER]\n{user_text}"
        res = client.models.count_tokens(model=model, contents=combined)
        return int(getattr(res, "total_tokens", 0)) or _rough_tokens(combined)
    except Exception as e:
        log(f"⚠️ count_tokens unavailable, using rough estimate: {e}")
        return _rough_tokens(system_text) + _rough_tokens(user_text)

# ---------------- Tools exposed to the model ----------------
def list_dir(rel_path: str = ".") -> Dict[str, Any]:
    base = _safe_path(rel_path)
    items = []
    for p in sorted(base.rglob("*")):
        if p.is_file():
            items.append(str(p.relative_to(PROJECT_DIR)).replace("\\", "/"))
            if len(items) >= LISTDIR_MAX:
                return {"ok": True, "items": items, "truncated": True, "limit": LISTDIR_MAX}
    return {"ok": True, "items": items, "truncated": False, "limit": LISTDIR_MAX}

def read_file(rel_path: str) -> Dict[str, Any]:
    p = _safe_path(rel_path)
    if not p.exists():
        return {"ok": False, "error": "not_found", "path": rel_path}
    raw = p.read_bytes()
    size = len(raw)
    if size <= MAX_READ_BYTES:
        txt = raw.decode("utf-8", errors="ignore")
        return {"ok": True, "path": rel_path, "content": txt, "size": size, "truncated": False}
    head = raw[: MAX_READ_BYTES // 2].decode("utf-8", errors="ignore")
    tail = raw[-MAX_READ_BYTES // 2 :].decode("utf-8", errors="ignore")
    marker = f"\n/* TRUNCATED {size} bytes -> {MAX_READ_BYTES} bytes (head+tail) */\n"
    txt = head + marker + tail
    return {"ok": True, "path": rel_path, "content": txt, "size": size, "truncated": True}

def write_file(rel_path: str, content: str) -> Dict[str, Any]:
    if not _allowed_file(rel_path):
        return {"ok": False, "error": "write_not_allowed", "path": rel_path}
    p = _safe_path(rel_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    log(f"📝 wrote {rel_path} ({len(content)} bytes)")
    return {"ok": True, "path": rel_path, "size": len(content)}

def run_cmd(cmd: str, cwd: Optional[str] = None, timeout: int = 1800) -> Dict[str, Any]:
    if not _allowed_cmd(cmd):
        return {"ok": False, "error": "cmd_not_allowed", "cmd": cmd}
    wd = _safe_path(cwd) if cwd else PROJECT_DIR
    log(f"🏃 running: {cmd}")
    try:
        proc = subprocess.run(
            cmd, cwd=str(wd), shell=True, check=False,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout
        )
        ok = (proc.returncode == 0)
        if ok:
            log(f"✅ ok: {cmd}")
        else:
            log(f"❌ rc={proc.returncode}: {cmd}")
            err_tail = (proc.stderr or "")[-800:]
            out_tail = (proc.stdout or "")[-400:]
            if err_tail:
                for line in err_tail.splitlines(): log(f"   ! {line}")
            if out_tail:
                for line in out_tail.splitlines(): log(f"   > {line}")
        return {
            "ok": ok, "rc": proc.returncode, "cmd": cmd,
            "cwd": str(wd.relative_to(PROJECT_DIR)),
            "stdout": proc.stdout[-20000:], "stderr": proc.stderr[-20000:],
        }
    except subprocess.TimeoutExpired as e:
        log(f"⏱️ timeout: {cmd}")
        return {"ok": False, "error": "timeout", "cmd": cmd, "stdout": e.stdout, "stderr": e.stderr}

def git_pull_rebase_main() -> Dict[str, Any]:
    a = run_cmd("git checkout main")
    b = run_cmd("git pull --rebase")
    return {"ok": a.get("ok") and b.get("ok"), "detail": [a, b]}

def git_checkout_branch(branch: str) -> Dict[str, Any]:
    a = run_cmd(f"git checkout {branch}")
    if a.get("ok"): return {"ok": True, "branch": branch, "created": False}
    b = run_cmd(f"git checkout -b {branch}")
    return {"ok": b.get("ok"), "branch": branch, "created": True, "detail": [a, b]}

def bump_version(new_version: str) -> Dict[str, Any]:
    if not re.fullmatch(r"\d+\.\d+\.\d+", new_version):
        return {"ok": False, "error": "bad_version"}
    return run_cmd(f"npm pkg set version={new_version}", cwd="app/desktop")

def _existing_allowed(path: str) -> bool:
    p = _safe_path(path)
    return p.exists() and path.replace("\\","/") in ALLOWED_EDIT

def _changed_allowed_files() -> List[str]:
    st = run_cmd("git status --porcelain")
    if not st.get("ok"): return []
    lines = (st.get("stdout") or "").splitlines()
    changed = []
    for line in lines:
        if not line.strip(): continue
        # formats: " M path", "?? path", "A  path"
        path = line[3:].strip()
        if path == "pnpm-lock.yaml" and INCLUDE_LOCKFILE:
            changed.append(path)
        elif path.replace("\\","/") in ALLOWED_EDIT and _safe_path(path).exists():
            changed.append(path)
    return changed

def _files_for_commit() -> List[str]:
    files = _changed_allowed_files()
    # also include pnpm-lock.yaml if explicitly requested and present
    if INCLUDE_LOCKFILE:
        p = _safe_path("pnpm-lock.yaml")
        if p.exists() and "pnpm-lock.yaml" not in files:
            # only add if changed
            st = run_cmd("git status --porcelain")
            if "pnpm-lock.yaml" in (st.get("stdout") or ""):
                files.append("pnpm-lock.yaml")
    return files

def _git_add(paths: List[str]) -> Dict[str, Any]:
    if not paths:
        return {"ok": False, "error": "nothing_to_add"}
    args = " ".join(shlex.quote(p) for p in paths)
    return run_cmd(f"git add {args}")

def _commit(message: str) -> Dict[str, Any]:
    return run_cmd(f'git commit -m {shlex.quote(message)}')

def _push_main_head() -> Dict[str, Any]:
    # Push current HEAD to main explicitly
    return run_cmd("git push origin HEAD:refs/heads/main")

def _tag_create_and_push(version: str) -> Dict[str, Any]:
    t1 = run_cmd(f'git tag -a v{version} -m "Desktop v{version}"')
    if not t1.get("ok"):
        return {"ok": False, "detail": [t1]}
    t2 = run_cmd(f"git push origin v{version}")
    return {"ok": t2.get("ok"), "detail": [t1, t2]}

def _tag_delete_local(version: str) -> Dict[str, Any]:
    return run_cmd(f"git tag -d v{version}")

def tag_push(version: str) -> Dict[str, Any]:
    # compatibility with tool list
    return _tag_create_and_push(version)

def commit_push(branch: str, message: str) -> Dict[str, Any]:
    # compatibility function used by model
    files = _files_for_commit()
    s1 = _git_add(files)
    if not s1.get("ok"):
        return {"ok": False, "detail": [s1], "reason": "no_files_or_add_failed"}
    s2 = _commit(message)
    if not s2.get("ok"):
        return {"ok": False, "detail": [s1, s2]}
    s3 = _push_main_head() if PUSH_MAIN else run_cmd(f"git push origin {branch}")
    return {"ok": s3.get("ok"), "detail": [s1, s2, s3]}

def _is_tracked(rel: str) -> bool:
    """Return True if rel is tracked by git (avoids pathspec errors on checkout)."""
    res = run_cmd(f"git ls-files --error-unmatch {shlex.quote(rel)}")
    return bool(res.get("ok"))

def revert_allowed_files() -> Dict[str, Any]:
    ok_all = True
    details = []
    for rel in sorted(ALLOWED_EDIT):
        if _safe_path(rel).exists() and _is_tracked(rel):
            r = run_cmd(f"git checkout -- {rel}")
            ok_all = ok_all and r.get("ok")
            details.append(r)
    return {"ok": ok_all, "detail": details}

# ---------------- Memory & context ----------------
MEM_PATH = STATE_DIR / "memory.json"
def memory_read() -> Dict[str, Any]:
    if not MEM_PATH.exists(): return {"ok": True, "memory": {}}
    try:
        return {"ok": True, "memory": json.loads(MEM_PATH.read_text())}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def memory_write(note: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    cur = {}
    if MEM_PATH.exists():
        try: cur = json.loads(MEM_PATH.read_text())
        except Exception: cur = {}
    logs = cur.get("logs", [])
    logs.append({"ts": int(time.time()), "note": note, "data": data or {}})
    cur["logs"] = logs[-200:]
    MEM_PATH.write_text(json.dumps(cur, indent=2))
    log(f"🧠 memory: {note}")
    return {"ok": True, "size": len(cur["logs"])}

def get_pkg_version() -> Optional[str]:
    p = APP_DIR / "package.json"
    if not p.exists(): return None
    try:
        return json.loads(p.read_text()).get("version")
    except Exception:
        return None

def next_patch(v: str) -> str:
    a,b,c = map(int, v.split("."))
    return f"{a}.{b}.{c+1}"

# ---------------- Per-run reports helpers ----------------
def _cleanup_old_reports(keep: int = int(os.environ.get("AGENT_REPORTS_KEEP", "100"))):
    try:
        files = sorted(REPORTS_DIR.glob("*.*"), key=lambda p: p.stat().st_mtime, reverse=True)
        for p in files[keep:]:
            try: p.unlink()
            except Exception: pass
    except Exception as e:
        log(f"⚠️ cleanup reports failed: {e}")

def _make_run_id(user_goal: str) -> str:
    stamp = time.strftime("%Y%m%d-%H%M%S")
    try:
        version = get_pkg_version() or "unknown"
    except Exception:
        version = "unknown"
    shipflag = "shipON" if SHIP else "shipOFF"
    slug = re.sub(r"[^a-z0-9]+", "-", (user_goal or "").lower()).strip("-")[:40] or "run"
    return f"{stamp}-v{version}-{shipflag}-{slug}"

def _open_run_log(run_id: str) -> Dict[str, Any]:
    global RUN_LOG_FILE
    full_path = REPORTS_DIR / f"{run_id}.full.log"
    try:
        full_path.write_text("", encoding="utf-8")
        RUN_LOG_FILE = full_path
        return {"ok": True, "path": str(full_path)}
    except Exception as e:
        RUN_LOG_FILE = None
        return {"ok": False, "error": str(e)}

def _save_summary(run_id: str, summary: str) -> None:
    text = "=== AGENT SUMMARY ===\n\n" + (summary or "(no summary text)") + "\n"
    p = REPORTS_DIR / f"{run_id}.summary.txt"
    try:
        p.write_text(text, encoding="utf-8")
        log(f"🧾 saved summary to {p.name}")
    except Exception as e:
        log(f"⚠️ could not save summary: {e}")
    # also append to the per-run full log
    try:
        if RUN_LOG_FILE:
            with RUN_LOG_FILE.open("a", encoding="utf-8") as f:
                f.write("\n" + text)
    except Exception:
        pass

# ---------------- Feedback & GH check ----------------
def read_feedback() -> str:
    try:
        if FEEDBACK_PATH.exists():
            txt = FEEDBACK_PATH.read_text(encoding="utf-8").strip()
            if txt:
                rot = STATE_DIR / f"feedback.{int(time.time())}.txt"
                FEEDBACK_PATH.rename(rot)
                log("💬 consumed operator feedback from feedback.txt")
                return txt
    except Exception as e:
        log(f"⚠️ feedback read error: {e}")
    return ""

def check_github_actions(version: str) -> Dict[str, Any]:
    if not GITHUB_REPO or not GITHUB_CHECK:
        return {"ok": False, "reason": "not_configured"}
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/runs?per_page=15&event=push"
        r = requests.get(url, headers=headers, timeout=20)
        if r.status_code != 200:
            log(f"⚠️ GH API status {r.status_code}: {r.text[:200]}")
            return {"ok": False, "status": r.status_code}
        runs = r.json().get("workflow_runs", [])
        for run in runs:
            title = f"{run.get('name','')} {run.get('display_title','')}"
            if f"v{version}" in title:
                log(f"📦 GH run: {run.get('status')} / {run.get('conclusion')} — {run.get('html_url')}")
                return {"ok": True, "status": run.get("status"), "conclusion": run.get("conclusion"),
                        "url": run.get("html_url")}
        # fallback latest on branch
        url2 = f"https://api.github.com/repos/{GITHUB_REPO}/actions/runs?per_page=1&branch={GITHUB_FALLBACK_REF}"
        r2 = requests.get(url2, headers=headers, timeout=20)
        if r2.status_code == 200 and r2.json().get("workflow_runs"):
            run = r2.json()["workflow_runs"][0]
            log(f"📦 GH latest on {GITHUB_FALLBACK_REF}: {run.get('status')} / {run.get('conclusion')} — {run.get('html_url')}")
            return {"ok": True, "status": run.get("status"), "conclusion": run.get("conclusion"),
                    "url": run.get("html_url")}
        return {"ok": False, "reason": "no_runs_found"}
    except Exception as e:
        log(f"⚠️ GH check error: {e}")
        return {"ok": False, "error": str(e)}

# ---------------- Client & prompts ----------------
def make_client() -> genai.Client:
    return genai.Client(
        vertexai=True,
        project=os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
    )

SYSTEM_PROMPT = """
You are the Icon Desktop release agent.

Hard rules:
- Always read the current repo files before editing.
- Run install -> build -> tests. If they fail and AGENT_REVERT_ON_FAIL=1, revert changes to HEAD and try a smaller fix.
- Never push or tag unless SHIP=1 (the tool will refuse).

Targets:
- Get app to poulate in windows as a functional app with icon in task bar, not just run in the background. 
- Global hotkeys: CommandOrControl+Shift+O (and 0), CommandOrControl+Shift+Backspace.
- Add effects to stickers, like spinning and floating and patterning as well as visual and audio effects from packages. 
- Add macro keys that change and mix and match sets of seffects from all asssets on screen. 
- Add in "Spawn 50" button that spams memes from your library, make sure they are rendomly but adequetly sized.

Output:
- Summarize what changed and why.
- Also include recomendations for future work that either needs to be done or would make the app better!
- Record a memory note with the diff summary and next steps.
"""

def _pin_smoke_and_normalize():
    if PIN_SMOKE:
        p = _safe_path("app/desktop/scripts/smoke-sticker-bridge.js")
        p.parent.mkdir(parents=True, exist_ok=True)
        old = p.read_text(encoding="utf-8") if p.exists() else ""
        if old != PINNED_SMOKE:
            p.write_text(PINNED_SMOKE, encoding="utf-8")
            log("🧪 pinned app/desktop/scripts/smoke-sticker-bridge.js")
    # normalize script path
    pkg = _safe_path("app/desktop/package.json")
    try:
        d = json.loads(pkg.read_text())
        d.setdefault("scripts", {})["test:smoke"] = "node scripts/smoke-sticker-bridge.js"
        pkg.write_text(json.dumps(d, indent=2) + "\n")
        log("🧪 normalized app/desktop/package.json scripts.test:smoke")
    except Exception as e:
        log(f"⚠️ could not normalize package.json: {e}")

def _auto_ship_with_retries(initial_version: str, max_attempts: int = 3) -> Dict[str, Any]:
    """bump->add(commit)->push main->tag; on conflicts or tag collisions, bump and retry"""
    version = initial_version
    for attempt in range(1, max_attempts+1):
        log(f"🚢 ship attempt {attempt}/{max_attempts} for v{version}")
        bump_version(version)
        files = _files_for_commit()
        if not files:
            log("⚠️ nothing to commit from allowed files; attempting to push HEAD anyway")
        else:
            add = _git_add(files)
            if not add.get("ok"):
                log("⚠️ git add failed; filtering again and retrying once")
                files = [f for f in files if _safe_path(f).exists()]
                add = _git_add(files)
                if not add.get("ok"):
                    return {"ok": False, "stage": "add", "detail": add}
            cm = _commit(f"fix(desktop): sticker spawn single-click + HUD dedupe; v{version}")
            if not cm.get("ok"):
                # If commit failed because nothing to commit, continue
                st = run_cmd("git status")
                if "nothing to commit" not in (cm.get("stdout","") + cm.get("stderr","") + st.get("stdout","")):
                    return {"ok": False, "stage": "commit", "detail": cm}
        # push HEAD to main
        ps = _push_main_head()
        if not ps.get("ok"):
            # try rebase + push again
            run_cmd("git pull --rebase origin main")
            ps = _push_main_head()
            if not ps.get("ok"):
                # bump and retry
                version = next_patch(version)
                continue
        # tag & push tag
        tg = _tag_create_and_push(version)
        if tg.get("ok"):
            return {"ok": True, "version": version, "detail": [ps, tg]}
        else:
            # likely tag collision; delete local tag if created and bump
            _tag_delete_local(version)
            version = next_patch(version)
            continue
    return {"ok": False, "stage": "final", "version": version}

def run_agent(user_goal: str):
    global RUN_LOG_FILE
    # single-instance lock
    STATE_DIR.mkdir(exist_ok=True)
    lock_file = (STATE_DIR / "run.lock").open("w")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log("🔒 another agent instance is running; exiting.")
        return

    # per-run reporting
    _cleanup_old_reports()
    run_id = _make_run_id(user_goal)
    op = _open_run_log(run_id)
    if op.get("ok"):
        log(f"🧾 per-run logging enabled: {op['path']}")
    else:
        log(f"⚠️ per-run log not opened: {op.get('error')}")

    client = make_client()

    # context
    context_txt = ""
    ctx_path = PROJECT_DIR / "AGENT_CONTEXT.md"
    if ctx_path.exists():
        try:
            context_txt = ctx_path.read_text(encoding="utf-8")
            context_txt = _shrink_text(context_txt, 120_000)
        except Exception:
            context_txt = ""
    feedback_txt = read_feedback()
    if feedback_txt: feedback_txt = _shrink_text(feedback_txt, 40_000)

    current_version = get_pkg_version() or "1.0.127"
    desired = next_patch(current_version)

    kickoff = f"""
Operator goal: {user_goal}

Env:
- Repo root: {PROJECT_DIR}
- Work branch: {BRANCH}
- Current app version: {current_version}
- Target patch version: {desired}
- Ship mode: {"ON" if SHIP else "OFF"} (push to {"main" if PUSH_MAIN else BRANCH})
- Include lockfile: {"YES" if INCLUDE_LOCKFILE else "NO"}
- Agent version: {AGENT_VERSION}

Context (trimmed):
{context_txt}

Operator feedback (trimmed):
{feedback_txt}

Steps:
- Pull main; work on {BRANCH}.
- Read preload + library; minimal fixes for single-spawn + dedupe.
- Add/refresh jsdom smoke + package.json 'test:smoke'.
- Outside model: pin smoke (if enabled), install, build, test.
- On failure + REVERT: revert allowlisted files and try a smaller patch.
- If SHIP: auto-bump on conflicts, push HEAD->main, tag vX.Y.Z.
- Write memory note + next steps.
"""

    prelim_cfg = types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT)
    approx_tokens = _count_tokens(client, MODEL, SYSTEM_PROMPT, kickoff)
    log(f"🧮 token preflight: approx={approx_tokens}, budget={TOKEN_BUDGET} (+{TOKEN_MARGIN} margin)")
    if approx_tokens > (TOKEN_BUDGET - TOKEN_MARGIN):
        log("✂️ shrinking kickoff to fit budget")
        context_txt2 = _shrink_text(context_txt, 60_000)
        feedback_txt2 = _shrink_text(feedback_txt, 20_000)
        kickoff = kickoff.replace(context_txt, context_txt2).replace(feedback_txt, feedback_txt2)

    tools = [
        list_dir, read_file, write_file, run_cmd,
        git_pull_rebase_main, git_checkout_branch,
        revert_allowed_files,
        memory_read, memory_write
    ]
    if SHIP:
        tools += [bump_version, commit_push, tag_push]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=tools,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=MAX_CALLS),
        max_output_tokens=4096,
        temperature=0.15,
    )

    passes_done = 0
    while True:
        passes_done += 1
        # Pass header
        if MAX_PASSES == 0:
            log(f"🔁 pass {passes_done} (unlimited)")
        else:
            log(f"🔁 pass {passes_done}/{MAX_PASSES}")
        # Talk to model
        try:
            resp = client.models.generate_content(model=MODEL, contents=kickoff.strip(), config=config)
        except Exception as e:
            msg = str(e)
            if "exceeds the maximum number of tokens" in msg:
                log("⚠️ token overflow; retrying with minimal kickoff")
                resp = client.models.generate_content(
                    model=MODEL,
                    contents=f"Operator goal: {user_goal}\n(Using minimal kickoff after overflow.)\nProceed with tools.",
                    config=config,
                )
            elif "RESOURCE_EXHAUSTED" in msg or "429" in msg:
                log("⏳ 429 from API; backing off 10s and retrying once")
                time.sleep(10)
                resp = client.models.generate_content(
                    model=MODEL, contents=kickoff.strip(), config=config
                )
            else:
                log(f"💥 generate_content error: {e}")
                RUN_LOG_FILE = None
                raise

        # Always pin smoke + normalize before build/test
        _pin_smoke_and_normalize()

        ok_install = run_cmd("pnpm --dir app/desktop install").get("ok")
        ok_build   = run_cmd("pnpm --dir app/desktop run build").get("ok") if ok_install else False
        ok_test    = run_cmd("pnpm --dir app/desktop run test:smoke").get("ok") if ok_build else False

        if not (ok_install and ok_build and ok_test):
            log("🛑 build/test gate failed.")
            if REVERT_ON_FAIL:
                log("↩️  reverting allowlisted files to HEAD")
                revert_allowed_files()
            log("📣 Not shipping due to failed tests.")
            print("\n=== AGENT SUMMARY ===\n")
            summary_text = resp.text or "(no summary text)"
            print(summary_text)
            _save_summary(run_id, summary_text)
            # next pass?
            if MAX_PASSES == 0 or passes_done < MAX_PASSES:
                time.sleep(SLEEP_BETWEEN_PASSES)
                continue
            log("🏁 agent finished (failed gate, max passes reached)")
            try:
                prompt = "Build/test failed; see log. Adjust feedback in /.agent/feedback.txt and retry."
                (STATE_DIR / "next_steps.txt").write_text(prompt, encoding="utf-8")
            except Exception as e:
                log(f"⚠️ could not write next_steps.txt: {e}")
            RUN_LOG_FILE = None
            return

        # If we got here, tests are green for this pass
        log("🟢 build/test gate GREEN")

        shipped = False
        shipped_version = None
        if SHIP:
            # choose base desired = current+1 (re-read actual version after build)
            current_version = get_pkg_version() or "1.0.127"
            desired = next_patch(current_version)
            result = _auto_ship_with_retries(desired, max_attempts=4)
            shipped = result.get("ok", False)
            shipped_version = result.get("version")
            if shipped:
                log(f"🚢 shipped v{shipped_version} to {'main' if PUSH_MAIN else BRANCH} and pushed tag")
                if GITHUB_REPO and GITHUB_CHECK:
                    gh = check_github_actions(shipped_version)
                    if gh.get("ok"):
                        log(f"📣 GH status: {gh.get('status')} / {gh.get('conclusion')} — {gh.get('url')}")
                    else:
                        log(f"📣 GH status unavailable: {gh}")
            else:
                log(f"⚠️ ship failed after retries: {result}")

        print("\n=== AGENT SUMMARY ===\n")
        summary_text = resp.text or "(no summary text)"
        print(summary_text)
        _save_summary(run_id, summary_text)

        # Write operator prompt
        try:
            prompt = (
                "Release cycle note:\n"
                f"- Build: {'✅' if ok_install and ok_build else '❌'}  "
                f"Test: {'✅' if ok_test else '❌'}  "
                f"Ship: {'✅ v'+str(shipped_version) if shipped else 'skipped (SHIP=0 or ship failed)'}\n\n"
                "Next:\n- After you install the .exe, add feedback in /.agent/feedback.txt:\n"
                "- Did Library clicks spawn exactly one sticker?\n"
                "- HUD + hotkeys?\n"
                "- What should we add/remove next?\n"
            )
            (STATE_DIR / "next_steps.txt").write_text(prompt, encoding="utf-8")
            log("📝 wrote /.agent/next_steps.txt with operator prompt")
        except Exception as e:
            log(f"⚠️ could not write next_steps.txt: {e}")

        # Stop after first green pass unless unlimited passes requested
        if not SHIP and (MAX_PASSES == 0 or passes_done < MAX_PASSES):
            time.sleep(SLEEP_BETWEEN_PASSES)
            continue
        log("🏁 agent finished")
        RUN_LOG_FILE = None
        return

if __name__ == "__main__":
    goal = "Fix Library click -> sticker spawn + dedupe; smoke test; build & test; ship if green."
    if len(sys.argv) > 1:
        goal = " ".join(sys.argv[1:])
    run_agent(goal)
