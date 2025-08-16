#!/usr/bin/env bash
set -Eeuo pipefail

cd /srv/icon

log()  { printf '%s: %s\n' "$1" "$2"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1" >&2; exit 1; }; }
trap 'log "ERROR" "line $LINENO exit $?"' ERR

need git; need jq; need curl

: "${LINEAR_API_KEY:?Set LINEAR_API_KEY}"
: "${PROJECT_NAME:?Set PROJECT_NAME or LINEAR_PROJECT_ID}"
: "${GIT_REMOTE:=origin}"
: "${GIT_DEFAULT_BRANCH:=main}"

# --- 1) Commit range since last agent-run tag ---
last_tag="$(git tag --list 'agent-run/*' | sort | tail -1 || true)"
if [[ -n "$last_tag" ]]; then
  range="${last_tag}..HEAD"
else
  range="HEAD~20..HEAD"   # first run window
fi
log "INFO" "Using commit range: ${range}"

# --- 2) Create a unique agent-run tag and push only that tag ---
now_utc="$(date -u +%Y%m%d-%H%M%S)"
new_tag="agent-run/${now_utc}"
git tag -a "$new_tag" -m "Agent run ${now_utc}" || true
if ! git push "$GIT_REMOTE" "$new_tag"; then
  log "WARN" "Could not push tag ${new_tag} (already exists or network issue); continuing"
fi

# --- 3) Build the summary body ---
commits_md="$(git log --no-merges --pretty='- %h %s (%an)' ${range} || true)"
files_md="$(git diff --name-status ${range} 2>/dev/null | sed 's/^/- /' || true)"
issues="$(git log ${range} --pretty=%s | grep -oE '([A-Z]{2,}-[0-9]+)' | sort -u || true)"

read -r -d '' body <<EOF || true
### What the agent did in the run — ${now_utc}

**Git tag:** \`${new_tag}\`

#### Commits
${commits_md:-"(none)"}

#### Files changed
${files_md:-"(none)"}
EOF

# --- Utility: GraphQL POST ---
gql() {
  local q="$1"; shift
  local vars="${1:-{}}"
  jq -nc --arg q "$q" --argjson v "$vars" '{query:$q, variables:$v}' \
  | curl -fsS https://api.linear.app/graphql \
      -H 'Content-Type: application/json' \
      -H "Authorization: ${LINEAR_API_KEY}" \
      --data-binary @-
}

# --- 4) Resolve Linear project id (helper -> fallback) ---
pid=""
if [[ -x /srv/icon/linear.sh ]]; then
  pid="$(/srv/icon/linear.sh resolve_project_id 2>/dev/null || true)"
fi

if [[ -z "${pid}" && -n "${PROJECT_NAME:-}" ]]; then
  log "INFO" "Falling back to direct Linear lookup for project: ${PROJECT_NAME}"
  pid="$(
    jq -nc --arg name "${PROJECT_NAME}" \
      '{query:"query($name:String!){ projects(first:1, filter:{ name:{ eq:$name } }){ nodes{ id } } }",
        variables:{name:$name}}' \
    | curl -fsS https://api.linear.app/graphql \
        -H 'Content-Type: application/json' \
        -H "Authorization: ${LINEAR_API_KEY}" \
        --data-binary @- \
    | jq -r '.data.projects.nodes[0].id // empty'
  )"
fi

# --- 5) Create a Project Update (safe) ---
if [[ -n "${pid}" ]]; then
  if [[ -x /srv/icon/linear.sh ]]; then
    /srv/icon/linear.sh project_update_create "$pid" "$body" "neutral" >/dev/null 2>&1 \
      || log "WARN" "Posting Linear Project Update failed"
  else
    # Fallback direct mutation if helper not present
    jq -nc --arg pid "$pid" --arg body "$body" --arg health "neutral" \
      '{query:"mutation($input:ProjectUpdateCreateInput!){ projectUpdateCreate(input:$input){ success } }",
        variables:{ input:{ projectId:$pid, body:$body, health:$health } }}' \
    | curl -sS https://api.linear.app/graphql \
        -H 'Content-Type: application/json' \
        -H "Authorization: ${LINEAR_API_KEY}" \
        --data-binary @- >/dev/null 2>&1 \
      || log "WARN" "Posting Linear Project Update failed"
  fi
else
  log "WARN" "Resolving project id failed (PROJECT_NAME='${PROJECT_NAME}')."
fi

# --- 6) Attach the run tag URL to the project (safe) ---
repo_url=""; tag_url=""
if git remote get-url "$GIT_REMOTE" >/dev/null 2>&1; then
  repo_url="$(git remote get-url "$GIT_REMOTE" | sed 's/\.git$//')"
  tag_url="${repo_url}/releases/tag/${new_tag}"
  if [[ -n "${pid:-}" ]]; then
    if [[ -x /srv/icon/linear.sh ]]; then
      /srv/icon/linear.sh attach_url_to_project "$pid" "Agent run ${now_utc}" "$tag_url" >/dev/null 2>&1 \
        || log "WARN" "Attach project URL failed"
    else
      # Fallback: create an EntityExternalLink on the project
      jq -nc --arg pid "$pid" --arg label "Agent run ${now_utc}" --arg url "$tag_url" \
        '{query:"mutation($input:EntityExternalLinkCreateInput!){ entityExternalLinkCreate(input:$input){ success } }",
          variables:{ input:{ projectId:$pid, label:$label, url:$url } }}' \
      | curl -sS https://api.linear.app/graphql \
          -H 'Content-Type: application/json' \
          -H "Authorization: ${LINEAR_API_KEY}" \
          --data-binary @- >/dev/null 2>&1 \
        || log "WARN" "Attach project URL failed"
    fi
  fi
fi

# --- 7) Attach that URL to any issues mentioned (safe) ---
if [[ -n "${issues:-}" && -n "${tag_url:-}" ]]; then
  while read -r iss; do
    if [[ -x /srv/icon/linear.sh ]]; then
      /srv/icon/linear.sh attach_url_to_issue "$iss" "Included in ${new_tag}" "$tag_url" >/dev/null 2>&1 || true
    else
      # Resolve PRE-123 -> UUID and attach link (best-effort)
      iid="$(
        jq -nc --arg id "$iss" '{query:"query($id:String!){ issue(id:$id){ id } }", variables:{id:$id}}' \
        | curl -sS https://api.linear.app/graphql \
            -H 'Content-Type: application/json' \
            -H "Authorization: ${LINEAR_API_KEY}" \
            --data-binary @- | jq -r '.data.issue.id // empty'
      )"
      if [[ -n "$iid" ]]; then
        jq -nc --arg iid "$iid" --arg label "Included in ${new_tag}" --arg url "$tag_url" \
          '{query:"mutation($input:EntityExternalLinkCreateInput!){ entityExternalLinkCreate(input:$input){ success } }",
            variables:{ input:{ issueId:$iid, label:$label, url:$url } }}' \
        | curl -sS https://api.linear.app/graphql \
            -H 'Content-Type: application/json' \
            -H "Authorization: ${LINEAR_API_KEY}" \
            --data-binary @- >/dev/null 2>&1 || true
      fi
    fi
  done <<< "$issues"
fi

log "INFO" "Agent run posted. Tag: ${new_tag}"
