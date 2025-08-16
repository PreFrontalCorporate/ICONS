#!/usr/bin/env python3
import os, json, glob, argparse
from pathlib import Path

USE_LLM = bool(os.environ.get("GOOGLE_CLOUD_PROJECT"))
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")

def load_texts(repo):
    paths = []
    for pat in ("README*", "docs/*.md", "app/desktop/README*", "app/desktop/package.json"):
        paths += glob.glob(str(Path(repo)/pat), recursive=True)
    blobs = []
    for p in sorted(set(paths))[:20]:
        try:
            blobs.append((p, Path(p).read_text(encoding="utf-8", errors="ignore")[:20000]))
        except Exception:
            pass
    return blobs

def simple_extract(plan):
    issues = plan.get("issues", [])
    buckets = {"feat":0,"fix":0,"chore":0,"refactor":0,"docs":0,"perf":0,"test":0}
    for it in issues:
        for l in it.get("labels", []):
            l = (l or "").lower()
            if l in buckets: buckets[l] += 1
    pieces = [f"{k}:{v}" for k,v in buckets.items() if v]
    overview = f"Imported {len(issues)} commits as issues." + (f" Breakdown: {', '.join(pieces)}." if pieces else "")
    return {"overview": overview, "milestone_notes": {}}

def call_llm(prompt):
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(
            vertexai=True,
            project=os.environ.get("GOOGLE_CLOUD_PROJECT",""),
            location=os.environ.get("GOOGLE_CLOUD_LOCATION","global"),
        )
        cfg = types.GenerateContentConfig(
            system_instruction="Summarize for PMs. Be concise and concrete.",
            max_output_tokens=1200,
            temperature=0.2
        )
        resp = client.models.generate_content(model=MODEL, contents=prompt, config=cfg)
        return (resp.text or "").strip()
    except Exception:
        return ""

def build_prompt(plan, docs):
    ms = [m.get("name") for m in plan.get("project", {}).get("milestones", [])]
    sample = plan.get("issues", [])[:60]
    doc_chunks = "\n".join([f"--- {p} ---\n{t[:4000]}" for p, t in docs])
    sample_json = json.dumps(sample, indent=2)[:12000]
    return (
f"""Docs (trimmed)
{doc_chunks}

Milestones (names): {ms}

Sample issues (first 60, JSON-trimmed):
{sample_json}

Task: Write a PM-facing overview of this application and release history. 6-12 sentences max.
Focus on capabilities, noteworthy changes, and areas of risk or follow-up, not code minutiae.
Return just the overview text, no markdown fences."""
    )

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    plan = json.load(open(args.inp, "r", encoding="utf-8"))
    docs = load_texts(args.repo)
    heur = simple_extract(plan)
    overview = heur["overview"]

    if USE_LLM:
        prompt = build_prompt(plan, docs)
        llm = call_llm(prompt)
        if llm:
            overview = f"{overview}\n\n{llm}"

    plan["overview"] = overview
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2)
    print(args.out)
