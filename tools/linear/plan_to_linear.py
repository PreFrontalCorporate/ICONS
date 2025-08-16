# plan_to_linear.py
# Purpose: Map your "plan" events to Linear GraphQL mutations/queries with the
# exact input shapes from the Linear schema. Works with LINEAR_API_KEY env var.

import os, sys, json, time, typing as t
import requests

LINEAR_GQL_ENDPOINT = "https://api.linear.app/graphql"  # official endpoint
# Auth header: send the API key as the Authorization value.
# (This is how Linear's GraphQL expects it.) See official docs.  # docs cited below

def _headers():
    token = os.getenv("LINEAR_API_KEY") or os.getenv("LINEAR_TOKEN")
    if not token:
        raise SystemExit("Set LINEAR_API_KEY in your environment.")
    return {
        "Authorization": token,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

class LinearClient:
    def __init__(self, session: requests.Session | None = None):
        self.s = session or requests.Session()

    def gql(self, query: str, variables: dict | None = None) -> dict:
        r = self.s.post(
            LINEAR_GQL_ENDPOINT,
            headers=_headers(),
            json={"query": query, "variables": variables or {}},
            timeout=60,
        )
        # Handle HTTP-level errors and Linear rate limits
        if r.status_code == 429:
            # Respect Linear's rate-limit headers if present
            reset_ms = int(r.headers.get("X-RateLimit-Complexity-Reset", "1000"))
            time.sleep(reset_ms / 1000.0)
            return self.gql(query, variables)
        if r.status_code >= 400:
            raise RuntimeError(f"HTTP {r.status_code} from Linear: {r.text}")

        payload = r.json()
        if "errors" in payload and payload["errors"]:
            # Surface GraphQL user errors cleanly
            msgs = "; ".join(e.get("message", "GraphQL error") for e in payload["errors"])
            raise ValueError(f"Linear GraphQL error(s): {msgs}")
        return payload["data"]

    # ---------- Operations ----------
    Q_PROJECT_MILESTONES = """
    query ProjectMilestonesByProject($pid: String!, $first: Int = 50, $after: String) {
      project(id: $pid) {
        id
        projectMilestones(first: $first, after: $after, orderBy: { updatedAt: { order: DESC } }) {
          nodes { id name targetDate }
          pageInfo { hasNextPage endCursor }
        }
      }
    }"""

    def list_project_milestones(self, project_id: str, first: int = 50) -> list[dict]:
        """Fetches all milestones for a project (paged)."""
        out: list[dict] = []
        after = None
        while True:
            data = self.gql(self.Q_PROJECT_MILESTONES, {"pid": project_id, "first": first, "after": after})
            conn = data["project"]["projectMilestones"]
            out.extend(conn["nodes"])
            if not conn["pageInfo"]["hasNextPage"]:
                break
            after = conn["pageInfo"]["endCursor"]
        return out

    M_CREATE_MILESTONE = """
    mutation CreateMilestone($input: ProjectMilestoneCreateInput!) {
      projectMilestoneCreate(input: $input) {
        success
        lastSyncId
        projectMilestone { id name targetDate createdAt status }
      }
    }"""

    def create_milestone(self, project_id: str, name: str,
                         description: str | None = None,
                         target_date: str | None = None,
                         sort_order: float | None = None) -> dict:
        variables = {"input": {"projectId": project_id, "name": name}}
        if description is not None: variables["input"]["description"] = description
        if target_date is not None: variables["input"]["targetDate"] = target_date  # YYYY-MM-DD
        if sort_order is not None: variables["input"]["sortOrder"] = sort_order
        data = self.gql(self.M_CREATE_MILESTONE, variables)
        return data["projectMilestoneCreate"]["projectMilestone"]

    M_UPDATE_MILESTONE = """
    mutation UpdateMilestone($id: String!, $input: ProjectMilestoneUpdateInput!) {
      projectMilestoneUpdate(id: $id, input: $input) {
        success
        lastSyncId
        projectMilestone { id name targetDate updatedAt status }
      }
    }"""

    def update_milestone(self, milestone_id: str, **fields) -> dict:
        # Allowed keys: name, description, targetDate, sortOrder, projectId
        input_fields = {}
        for k in ("name", "description", "targetDate", "sortOrder", "projectId"):
            if k in fields and fields[k] is not None:
                input_fields[k] = fields[k]
        if not input_fields:
            raise ValueError("No update fields provided.")
        data = self.gql(self.M_UPDATE_MILESTONE, {"id": milestone_id, "input": input_fields})
        return data["projectMilestoneUpdate"]["projectMilestone"]

    M_MOVE_MILESTONE = """
    mutation MoveMilestone($id: String!, $input: ProjectMilestoneMoveInput!) {
      projectMilestoneMove(id: $id, input: $input) {
        success
        lastSyncId
        previousIssueTeamIds { issueId teamId }
        previousProjectTeamIds { projectId teamIds }
        projectMilestone { id name sortOrder status }
      }
    }"""

    def move_milestone(self, milestone_id: str, to_project_id: str,
                       add_issue_team_to_project: bool | None = None,
                       new_issue_team_id: str | None = None) -> dict:
        input_obj = {"projectId": to_project_id}
        if add_issue_team_to_project is not None:
            input_obj["addIssueTeamToProject"] = add_issue_team_to_project
        if new_issue_team_id is not None:
            input_obj["newIssueTeamId"] = new_issue_team_id
        data = self.gql(self.M_MOVE_MILESTONE, {"id": milestone_id, "input": input_obj})
        return data["projectMilestoneMove"]["projectMilestone"]

    M_CREATE_LABEL = """
    mutation CreateIssueLabel($input: IssueLabelCreateInput!, $replaceTeamLabels: Boolean) {
      issueLabelCreate(input: $input, replaceTeamLabels: $replaceTeamLabels) {
        success
        issueLabel { id name color archivedAt }
      }
    }"""

    def create_issue_label(self, name: str, color: str | None = None,
                           team_id: str | None = None,
                           description: str | None = None,
                           replace_team_labels: bool | None = None) -> dict:
        input_obj = {"name": name}
        if color: input_obj["color"] = color
        if team_id: input_obj["teamId"] = team_id
        if description: input_obj["description"] = description
        vars = {"input": input_obj}
        if replace_team_labels is not None: vars["replaceTeamLabels"] = replace_team_labels
        data = self.gql(self.M_CREATE_LABEL, vars)
        return data["issueLabelCreate"]["issueLabel"]

    M_CREATE_ENTITY_LINK = """
    mutation LinkExternal($input: EntityExternalLinkCreateInput!) {
      entityExternalLinkCreate(input: $input) {
        success
        entityExternalLink { id label url createdAt updatedAt }
      }
    }"""

    def create_external_link_to_project(self, project_id: str, label: str, url: str) -> dict:
        data = self.gql(self.M_CREATE_ENTITY_LINK, {"input": {
            "projectId": project_id,
            "label": label,
            "url": url
        }})
        return data["entityExternalLinkCreate"]["entityExternalLink"]

# ---------- CLI test harness ----------
def _demo():
    """
    Example runs.
    Set LINEAR_API_KEY. Replace IDs with real ones from your workspace.
    """
    linear = LinearClient()

    # 1) Fetch milestones for a project
    pid = os.getenv("LINEAR_PROJECT_ID", "")
    if pid:
        m = linear.list_project_milestones(pid, first=50)
        print(f"Milestones for project {pid}: {json.dumps(m, indent=2)}")

    # 2) Create a milestone (optional example)
    # created = linear.create_milestone(project_id=pid, name="Beta Gate", target_date="2025-09-01")
    # print("Created milestone:", created)

    # 3) Create label
    # lbl = linear.create_issue_label(name="Backlog:Fun", color="#7c3aed")
    # print("Created label:", lbl)

    # 4) Link a commit to a project as an external link
    commit = os.getenv("EXAMPLE_COMMIT_SHA", "a8e8edda712aa26c4b5b03414d8bbfd97a563ad9")
    if pid:
        link = linear.create_external_link_to_project(
            project_id=pid,
            label=f"Commit {commit[:7]}",
            url=f"https://github.com/PreFrontalCorporate/icon/commit/{commit}"
        )
        print("Created entity link:", link)

if __name__ == "__main__":
    if "--demo" in sys.argv:
        _demo()
    else:
        print("Usage: python plan_to_linear.py --demo")
