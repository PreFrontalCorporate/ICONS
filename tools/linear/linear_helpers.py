from .linear_client import gql

def me():
    return gql("query{viewer{id name email}}")["viewer"]

def find_team_by_key(key: str):
    return gql("query($k:String!){ team(key:$k){ id name key }}", {"k": key})["team"]

def find_project_by_name(name: str):
    q = """query($q:String!){ projects(filter:{query:$q}, first:50){ nodes { id name url }}}"""
    nodes = gql(q, {"q": name})["projects"]["nodes"]
    return next((p for p in nodes if p["name"] == name), None)

def create_project(name, description=None, team_id=None, start_date=None, target_date=None, status="planned"):
    q = """mutation($input:ProjectCreateInput!){
      projectCreate(input:$input){ success project{ id name url startedAt targetDate }} }"""
    inp = {"name": name, "status": status}
    if description: inp["description"] = description
    if team_id: inp["teamId"] = team_id
    if start_date: inp["startDate"] = start_date
    if target_date: inp["targetDate"] = target_date
    return gql(q, {"input": inp})["projectCreate"]["project"]

def update_project(project_id, **fields):
    q = """mutation($id:String!,$input:ProjectUpdateInput!){
      projectUpdate(id:$id, input:$input){ success project{ id }} }"""
    return gql(q, {"id": project_id, "input": fields})

def create_project_milestone(project_id, name, target_date=None, description=None):
    q = """mutation($input:ProjectMilestoneCreateInput!){
      projectMilestoneCreate(input:$input){ success projectMilestone{ id name targetDate }} }"""
    inp = {"projectId": project_id, "name": name}
    if target_date: inp["targetDate"] = target_date
    if description: inp["description"] = description
    return gql(q, {"input": inp})["projectMilestoneCreate"]["projectMilestone"]

def create_label(name, color="#7950f2", team_id=None):
    q = """mutation($input:IssueLabelCreateInput!){
      issueLabelCreate(input:$input){ success issueLabel{ id name color }} }"""
    inp = {"name": name, "color": color}
    if team_id: inp["teamId"] = team_id
    return gql(q, {"input": inp})["issueLabelCreate"]["issueLabel"]

def create_issue(team_id, title, description=None, project_id=None, milestone_id=None, label_ids=None, assignee_id=None):
    q = """mutation($input:IssueCreateInput!){
      issueCreate(input:$input){ success issue{ id identifier url }} }"""
    inp = {"teamId": team_id, "title": title}
    if description: inp["description"] = description
    if project_id: inp["projectId"] = project_id
    if milestone_id: inp["projectMilestoneId"] = milestone_id
    if label_ids: inp["labelIds"] = label_ids
    if assignee_id: inp["assigneeId"] = assignee_id
    return gql(q, {"input": inp})["issueCreate"]["issue"]

def update_issue(issue_id, **fields):
    q = """mutation($id:String!,$input:IssueUpdateInput!){
      issueUpdate(id:$id, input:$input){ success issue{ id }} }"""
    return gql(q, {"id": issue_id, "input": fields})

def project_update(project_id, body_md, health="onTrack"):
    q = """mutation($input:ProjectUpdateCreateInput!){
      projectUpdateCreate(input:$input){ success projectUpdate{ id health createdAt }} }"""
    return gql(q, {"input": {"projectId": project_id, "body": body_md, "health": health}})
