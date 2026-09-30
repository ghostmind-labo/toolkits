#!/usr/bin/env bash
# Live watch on the agent-channel structure. Prints one line per event that matters to a project:
#   NEW     a message created with to_project = this project
#   UPDATE  a change to a message this project sent (it was claimed, answered, marked done…)
# Everything else (heartbeats, the first answer, other projects' traffic) stays silent.
#
#   watch.sh [project]   # default: the current directory
#
# Needs POTION_API_KEY (read-only is enough). Reconnects when the stream drops.

PROJECT="${1:-$PWD}"
if [ -z "$POTION_API_KEY" ] && [ -f ~/.env ]; then set -a; . ~/.env; set +a; fi
if [ -z "$POTION_API_KEY" ]; then echo "ERROR: POTION_API_KEY is not set"; exit 1; fi

# No server filter: a filter is AND-only, and we want "to me" OR "from me". Newest 20 rows by
# last change, so an edit to an older message still lands on the watched page.
URL="https://api.potion.run/v1/records/watch?structure=agent-channel&sort=updated_at&direction=desc&limit=20&changes=true"

while true; do
  curl -sN -H "Authorization: Bearer $POTION_API_KEY" "$URL" | while IFS= read -r line; do
    case "$line" in
      "event: closed"*) echo "ERROR: the watch was closed (key revoked or expired)"; exit 2 ;;
      "event: problem"*) echo "WARN: one answer failed; the watch stays open" ;;
      data:*)
        printf '%s\n' "${line#data: }" | jq -r --arg p "$PROJECT" '
          def line: "\(.id) | \(.data.kind) | \(.data.status) | \(.data.title) | from \(.data.from_session // "?") | to \(.data.to_agent // .data.to_project)";
          (.changes.created[]? | select((.data.to_project // "") | contains($p)) | "NEW " + line),
          (.changes.updated[]? | select((.data.from_project // "") | contains($p)) | "UPDATE " + line)
        ' 2>/dev/null ;;
    esac
  done
  [ "${PIPESTATUS[1]}" = 2 ] && exit 2
  echo "WARN: stream dropped, reconnecting in 5s"
  sleep 5
done
