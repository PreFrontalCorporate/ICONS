#!/usr/bin/env python3
"""
Minimal, robust plan -> Linear importer.
- Reuses or creates the project
- Creates milestones (if supported) via projectMilestones(filter:{ projectId: { eq: ... } })
- Creates issues, applies labels (creating if missing), due dates, and external links
- Optionally marks issues completed by moving to a 'completed'/'done' state (no backdating)
"""

import os, sys, json, argparse, time, random

# Make sure we can import the existing Linear client, even when running from /home
try:
    from tools.linear.linear_client import gql
except Exception:
    sys.path.insert(0, "/srv/icon")
    from tools.linear.linear_client import gql

MAX_PAGE = 250  # Linear hard cap per query

# ---------------- Label cache ----------------
_LABELS_INDEX = None  # maps (lower_name, team_id_or_None) -> label_id

def _prime_labels():
    """Fetch all labels once; cache by lowercase name + team_id (None for workspace labels)."""
    global _LABELS_INDEX
    if _LABELS_INDEX is not None:
        return
    _LABELS_INDEX = {}
    cursor = None
    while True:
        q = """
        query($n:Int!,$after:String){
          issueLabels(first:$n, after:$after){
            nodes{ id name team{ id } }
            pageInfo{ hasNextPage endCursor }
          }
        }"""
        data = gql(q, {"n": MAX_PAGE, "after": cursor})
        conn = data["issueLabels"]
        for node in conn["nodes"]:
            name = (node.get("name") or "").strip().lower()
            tid = (node.get("team") or {}).get("id")
            if not name:
                continue
            _LABELS_INDEX[(name, tid)] = node["id"]
            # Also map workspace/global labels
            if tid is None:
                _LABELS_INDEX[(name, None)] = node["id"]
        if not conn["pageInfo"]["hasNextPage"]:
            break
        cursor = conn["pageInfo"]["endCursor"]

def ensure_label(name, team_id, color="#7950f2"):
    """Return ID for a label by name; create it on the team if missing."""
    if not name:
        return None
    _prime_labels()
    key_name = (name.strip().lower())
    lid = _LABELS_INDEX.get((key_name, team_id)) or _LABELS_INDEX.get((key_name, None))
    if lid:
        return lid
    # Create team-specific label for determinism
    q = """
    mutation($input: IssueLabelCreateInput!){
      issueLabelCreate(input:$input){
        success
        issueLabel{ id name team{ id } }
      }
    }"""
    inp = {"name": name, "color": color, "teamId": team_id}
    created = gql(q, {"input": inp})["issueLabelCreate"]["issueLabel"]
    new_id = created["id"]
    _LABELS_INDEX[(key_name, team_id)] = new_id
    return new_id

# ---------------- Team states (for marking completed) ----------------
_STATE_CACHE = {}

def _team_states(team_id):
    if team_id in _STATE_CACHE:
        return _STATE_CACHE[team_id]
    q = """
    query($id:String!){
      team(id:$id){
        workflowStates(first:100){ nodes { id name type } }
      }
    }"""
    try:
        st = gql(q, {"id": team_id})["team"]["workflowStates"]["nodes"] or []
    except Exception:
        st = []
    _STATE_CACHE[team_id] = st
    return st

def find_completed_state_id(team_id):
    for s in _team_states(team_id):
        t = (s.get("type") or "").lower()
        n = (s.get("name") or "").lower()
        if t == "completed" or n in ("done", "completed", "closed", "shipped"):
            return s["id"]
    return None

def mark_issue_completed(issue_id, team_id):
    """Move issue to a completed state (does not backdate completedAt)."""
    done = find_completed_state_id(team_id)
    if not done:
        return False
    q = """
    mutation($id:String!, $input: IssueUpdateInput!){
      issueUpdate(id:$id, input:$input){ success }
    }"""
    gql(q, {"id": issue_id, "input": {"stateId": done}})
    time.sleep(0.05 + random.random() * 0.05)
    return True

# ---------------- Basic helpers ----------------
def find_team_by_key(key: str):
    data = gql("query($n:Int){ teams(first:$n){ nodes { id name key } } }", {"n": 200})
    for t in data["teams"]["nodes"]:
        if t.get("key") == key:
            return t
    keys = ", ".join(sorted([t.get("key","?") for t in data["teams"]["nodes"]]))
    sys.exit(f"Team key '{key}' not found. Available: {keys}")

def find_project_by_name_exact(name: str):
    data = gql("query($n:Int){ projects(first:$n){ nodes { id name url } } }", {"n": 200})
    for p in data["projects"]["nodes"]:
        if p.get("name") == name:
            return p
    return None

def create_project(name, description=None, team_id=None, start_date=None, target_date=None):
    """Create project; try with dates, then fallback without if schema rejects."""
    q = """
    mutation($input: ProjectCreateInput!) {
      projectCreate(input: $input) { success project { id name url } }
    }"""
    base = {"name": name, "teamIds": [team_id] if team_id else []}
    if description: base["description"] = description
    if start_date: base["startDate"] = start_date
    if target_date: base["targetDate"] = target_date

    last_err = None
    for try_dates in (True, False):
        inp = dict(base)
        if not try_dates:
            inp.pop("startDate", None)
            inp.pop("targetDate", None)
        try:
            return gql(q, {"input": inp})["projectCreate"]["project"]
        except Exception as e:
            last_err = e
            continue
    raise last_err

def list_project_milestones_map(project_id):
    """Return { name -> id } for milestones on a given project using projectMilestones(filter:{projectId:{eq}})."""
    out = {}
    cursor = None
    while True:
        q = """
        query($pid:String!,$n:Int!,$after:String){
          projectMilestones(first:$n, after:$after, filter:{ projectId: { eq: $pid } }){
            nodes{ id name targetDate }
            pageInfo{ hasNextPage endCursor }
          }
        }"""
        data = gql(q, {"pid": project_id, "n": 100, "after": cursor})["projectMilestones"]
        for node in data["nodes"]:
            nm = (node.get("name") or "").strip()
            if nm: out[nm] = node["id"]
        if not data["pageInfo"]["hasNextPage"]:
            break
        cursor = data["pageInfo"]["endCursor"]
    return out

def create_project_milestone(project_id, name, target_date=None, description=None):
    q = """
    mutation($input: ProjectMilestoneCreateInput!) {
      projectMilestoneCreate(input: $input) {
        success projectMilestone { id name targetDate }
      }
    }"""
    inp = {"projectId": project_id, "name": name}
    if target_date: inp["targetDate"] = target_date
    if description: inp["description"] = description
    return gql(q, {"input": inp})["projectMilestoneCreate"]["projectMilestone"]

def create_issue(team_id, title, description=None, project_id=None, project_milestone_id=None):
    q = """
    mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { id identifier url } }
    }"""
    inp = {"teamId": team_id, "title": (title or "")[:240]}
    if description:           inp["description"] = description
    if project_id:            inp["projectId"] = project_id
    if project_milestone_id:  inp["projectMilestoneId"] = project_milestone_id
    return gql(q, {"input": inp})["issueCreate"]["issue"]

def issue_update(issue_id, input_obj):
    q = """
    mutation($id:String!, $input: IssueUpdateInput!) {
      issueUpdate(id:$id, input:$input) { success issue { id } }
    }"""
    return gql(q, {"id": issue_id, "input": input_obj})

def attach_external_link(entity_id, title, url):
    if not url:
        return
    q = """
    mutation($input: EntityExternalLinkCreateInput!) {
      entityExternalLinkCreate(input:$input){ success }
    }"""
    gql(q, {"input": {"entityId": entity_id, "title": (title or "Link"), "url": url}})

# ---------------- CLI ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True, help="Path to enriched plan JSON")
    ap.add_argument("--team-key", required=True, help="Linear team key, e.g. PRE")
    ap.add_argument("--reuse-project-if-exists", action="store_true")
    ap.add_argument("--skip-milestones", action="store_true", help="Skip milestone list/create")
    args = ap.parse_args()

    plan = json.load(open(args.plan, "r", encoding="utf-8"))

    # Team
    team = find_team_by_key(args.team_key)
    team_id = team["id"]

    # Project metadata
    proj_meta = plan.get("project", {}) or {}
    proj_name = proj_meta.get("name") or "Imported Project"
    desc = (proj_meta.get("description") or "").strip()
    overview = (plan.get("overview") or "").strip()
    if overview:
        desc = (desc + ("\n\n---\nOverview:\n" if desc else "Overview:\n") + overview).strip()

    # Create or reuse project
    project = find_project_by_name_exact(proj_name) if args.reuse_project_if_exists else None
    if not project:
        project = create_project(
            name=proj_name,
            description=desc if desc else None,
            team_id=team_id,
            start_date=proj_meta.get("start_date"),
            target_date=proj_meta.get("target_date"),
        )
    print(f"Project: {project['name']}  {project['url']}")

    # Milestones
    ms_map = {}
    ms_created = 0
    ms_failed  = 0
    ms_skipped = 0
    milestones_supported = not args.skip_milestones
    if milestones_supported:
        try:
            ms_map = list_project_milestones_map(project["id"])
        except Exception as e:
            print(f"NOTE: Could not list milestones (continuing without milestones): {e}", file=sys.stderr)
            milestones_supported = False

    if milestones_supported:
        for m in (proj_meta.get("milestones") or []):
            nm = (m.get("name") or "").strip()
            if not nm:
                continue
            if nm in ms_map:
                ms_skipped += 1
                continue
            try:
                pm = create_project_milestone(
                    project_id=project["id"],
                    name=nm,
                    target_date=m.get("target_date"),
                    description=m.get("description"),
                )
                ms_map[nm] = pm["id"]
                ms_created += 1
                print(f"Milestone created: {pm['name']} ({pm.get('targetDate') or ''})")
            except Exception as e:
                ms_failed += 1
                print(f"WARNING: milestone failed: {nm} — {e}", file=sys.stderr)

    # Issues
    created, failed = 0, 0
    for idx, it in enumerate(plan.get("issues") or [], 1):
        try:
            # Optional milestone mapping by name
            ms_id = None
            if milestones_supported:
                ms_name = (it.get("milestone") or "").strip()
                if ms_name:
                    ms_id = ms_map.get(ms_name)

            issue = create_issue(
                team_id=team_id,
                title=it.get("title"),
                description=it.get("description"),
                project_id=project["id"],
                project_milestone_id=ms_id,
            )
            created += 1

            # Labels + due date
            wanted = list(dict.fromkeys([(l or "").strip() for l in (it.get("labels") or []) if l]))
            label_ids = [lid for lid in (ensure_label(n, team_id) for n in wanted) if lid]
            updates = {}
            if label_ids:           updates["labelIds"] = label_ids
            if it.get("due_date"):  updates["dueDate"] = it["due_date"]  # YYYY-MM-DD
            if updates:
                issue_update(issue["id"], updates)

            # If you want to mark completed, we do it by state (no backdating)
            if it.get("completed_at"):
                mark_issue_completed(issue["id"], team_id)

            # External links
            for link in (it.get("external_links") or []):
                attach_external_link(issue["id"], link.get("title"), link.get("url"))

            if created % 20 == 0:
                print(f"...created {created} issues so far")

        except Exception as e:
            failed += 1
            print(f"WARNING: issue failed ({it.get('title','(no title)')[:80]}): {e}", file=sys.stderr)

    print(
        f"Done. Milestones created: {ms_created} (skipped existing: {ms_skipped}, failed: {ms_failed}). "
        f"Issues created: {created}. Issues failed: {failed}."
    )

if __name__ == "__main__":
    main()
