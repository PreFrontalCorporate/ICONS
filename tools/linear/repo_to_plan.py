#!/usr/bin/env python3
import json, subprocess, re, os, argparse
from pathlib import Path

def sh(cmd):
    return subprocess.check_output(cmd, shell=True, text=True).strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--project-name", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--max-issues", type=int, default=200)
    args = ap.parse_args()

    os.chdir(args.repo)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    origin = sh("git config --get remote.origin.url || echo ''")
    tags = sh("git tag --list --sort=creatordate || true").splitlines()

    logfmt = "%H%x1f%aN%x1f%cI%x1f%s"
    lines = sh(f"git log --date=iso8601-strict --pretty=format:'{logfmt}' -n {args.max_issues}").splitlines()

    issues = []
    for line in lines:
        h, author, ciso, subject = line.split("\x1f")
        labels = []
        m = re.match(r"(feat|fix|chore|refactor|docs|perf|test)(\(.+?\))?:", subject, re.I)
        if m:
            labels.append(m.group(1).lower())
        try:
            stat = sh(f"git show --stat --oneline {h} | tail -n +2")
        except subprocess.CalledProcessError:
            stat = ""
        issues.append({
            "title": subject[:240],
            "completed_at": ciso,      # backdate on import
            "due_date": ciso[:10],
            "labels": labels,
            "external_links": [{
                "title": f"Commit {h[:7]}",
                "url": f"{origin.replace('.git','')}/commit/{h}" if "github.com" in origin else ""
            }],
            "description": f"**Author:** {author}\\n**Commit:** {h}\\n\\n```\\n{stat}\\n```"
        })

    first = sh("git log --reverse -1 --format=%cI") if lines else None
    last  = sh("git log -1 --format=%cI") if lines else None

    milestones = []
    for t in tags:
        try:
            td = sh(f"git log -1 --format=%cI {t}")[:10]
        except subprocess.CalledProcessError:
            td = None
        milestones.append({"name": t, "target_date": td})

    plan = {
      "project": {
        "name": args.project_name,
        "description": f"Backfilled from Git repo {origin}",
        "start_date": first[:10] if first else None,
        "target_date": last[:10] if last else None,
        "milestones": milestones
      },
      "issues": issues
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2)
    print(args.output)

if __name__ == "__main__":
    main()
