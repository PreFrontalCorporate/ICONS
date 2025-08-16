#!/usr/bin/env bash
set -Eeuo pipefail

endpoint="https://api.linear.app/graphql"

require_env() { : "${LINEAR_API_KEY:?set in env}"; }

gql() {
  local query="$1"; shift || true
  local vars_json="${1:-{}}"

  # ensure variables is valid JSON; fallback to {} if not
  if ! jq -e . >/dev/null 2>&1 <<<"$vars_json"; then
    vars_json='{}'
  fi

  local payload
  payload=$(jq -nc --arg q "$query" --argjson v "$vars_json" '{query:$q, variables:$v}')

  if [[ "${TRACE:-0}" == "1" ]]; then
    echo ">>> Request payload" >&2
    jq . <<<"$payload" >&2
  fi

  curl -sS "$endpoint" \
    -H 'Content-Type: application/json' \
    -H "Authorization: $LINEAR_API_KEY" \
    --data "$payload"
}

# --- Commands ---------------------------------------------------------------

cmd_viewer() {
  require_env
  gql 'query { viewer { id name email } }' '{}'
}

cmd_project_id_by_name() {
  require_env
  local name="${1:?project name required}"
  gql 'query($name:String!){
         projects(first:1, filter:{ name:{ eq:$name } }){
           nodes{ id name url }
         }
       }' "$(jq -nc --arg name "$name" '{name:$name}')" \
  | jq -r '.data.projects.nodes[0].id // empty'
}

cmd_list_milestones() {
  require_env
  local pid="${1:?project id}"; local first="${2:-50}"; local after="${3:-null}"
  gql 'query($pid:String!, $first:Int, $after:String){
         project(id:$pid){
           projectMilestones(first:$first, after:$after){
             nodes{ id name status targetDate sortOrder }
             pageInfo{ hasNextPage endCursor }
           }
         }
       }' "$(jq -nc --arg pid "$pid" --argjson first "$first" --argjson after "$after" \
              '{pid:$pid, first:$first, after:$after}')"
}

cmd_milestone_id_by_name() {
  require_env
  local pid="${1:?project id}"; local name="${2:?milestone name}"
  gql 'query($pid:String!, $name:String!){
         projectMilestones(first:1,
           filter:{ project:{ id:{ eq:$pid } }, name:{ eq:$name } }){
           nodes{ id name }
         }
       }' "$(jq -nc --arg pid "$pid" --arg name "$name" '{pid:$pid,name:$name}')" \
  | jq -r '.data.projectMilestones.nodes[0].id // empty'
}

cmd_create_milestone() {
  require_env
  local pid="${1:?project id}"; local name="${2:?name}"; local date="${3:?YYYY-MM-DD}"
  gql 'mutation($input:ProjectMilestoneCreateInput!){
         projectMilestoneCreate(input:$input){
           success projectMilestone{ id name status targetDate }
         }
       }' "$(jq -nc --arg pid "$pid" --arg name "$name" --arg date "$date" \
              '{input:{projectId:$pid, name:$name, targetDate:$date}}')"
}

cmd_update_milestone() {
  require_env
  local mid="${1:?milestone id}"; local new_name="${2:-}"; local new_date="${3:-}"
  local patch='{}'
  if [[ -n "$new_name" ]]; then patch=$(jq -nc --arg n "$new_name" '$ARGS.named' --arg n "$new_name" '{name:$n}'); fi
  if [[ -n "$new_date" ]]; then patch=$(jq -nc --argjson a "$patch" --arg d "$new_date" '$a + {targetDate:$d}'); fi
  gql 'mutation($id:String!,$input:ProjectMilestoneUpdateInput!){
         projectMilestoneUpdate(id:$id, input:$input){
           success lastSyncId projectMilestone{ id name targetDate }
         }
       }' "$(jq -nc --arg id "$mid" --argjson input "$patch" '{id:$id, input:$input}')"
}

cmd_delete_milestone() {
  require_env
  local mid="${1:?milestone id}"
  gql 'mutation($id:String!){
         projectMilestoneDelete(id:$id){ success lastSyncId }
       }' "$(jq -nc --arg id "$mid" '{id:$id}')"
}

cmd_issue_id() {
  require_env
  local ident="${1:?issue id or key like PRE-123}"
  gql 'query($id:String!){ issue(id:$id){ id } }' "$(jq -nc --arg id "$ident" '{id:$id}')" \
  | jq -r '.data.issue.id // empty'
}

cmd_attach_url_to_issue() {
  require_env
  local ident="${1:?issue id or key}" label="${2:?label}" url="${3:?url}"
  local iid; iid="$(cmd_issue_id "$ident")"
  [[ -n "$iid" ]] || { echo "could not resolve issue '$ident'" >&2; exit 1; }
  gql 'mutation($input:EntityExternalLinkCreateInput!){
         entityExternalLinkCreate(input:$input){
           entityExternalLink{ id label url createdAt updatedAt }
         }
       }' "$(jq -nc --arg iid "$iid" --arg lbl "$label" --arg u "$url" \
              '{input:{ issueId:$iid, label:$lbl, url:$u }}')"
}

# entry point
case "${1:-}" in
  viewer)                 shift; cmd_viewer "$@";;
  project_id_by_name)     shift; cmd_project_id_by_name "$@";;
  list_milestones)        shift; cmd_list_milestones "$@";;
  milestone_id_by_name)   shift; cmd_milestone_id_by_name "$@";;
  create_milestone)       shift; cmd_create_milestone "$@";;
  update_milestone)       shift; cmd_update_milestone "$@";;
  delete_milestone)       shift; cmd_delete_milestone "$@";;
  issue_id)               shift; cmd_issue_id "$@";;
  attach_url_to_issue)    shift; cmd_attach_url_to_issue "$@";;
  *) echo "usage: $0 {viewer|project_id_by_name|list_milestones|milestone_id_by_name|create_milestone|update_milestone|delete_milestone|issue_id|attach_url_to_issue}"; exit 2;;
esac
