#!/usr/bin/env bash
# Updates every installed Claude Code plugin, then asks each Claude session open in Herdr
# to reload its plugins.
#   refresh.sh [--dry-run] [--no-reload]
#     --dry-run     change nothing: list the plugins and the sessions that would be touched
#     --no-reload   update the plugins, leave the sessions alone
#
# A session is only sent /reload-plugins when it is idle at its prompt. One that is working,
# blocked on a question, or showing another screen is skipped and listed, so that nothing is
# typed into the middle of someone's work. The session this runs from is never typed into.
set -uo pipefail

dry=0 reload=1
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry=1 ;;
    --no-reload) reload=0 ;;
    *) echo "refresh.sh: unknown option $arg" >&2; exit 2 ;;
  esac
done
command -v jq >/dev/null || { echo "refresh.sh: jq is required" >&2; exit 1; }

# session and synced plugins are not installed from a marketplace, so there is nothing to update
versions() {
  claude plugin list --json | jq -r '.[] | select(.enabled and (.scope | IN("user", "project", "local", "managed")))
    | [.id, .scope, .version] | @tsv'
}

echo "== Plugins"
before="$(versions)"
if [ "$dry" = 1 ]; then
  echo "$before" | awk -F'\t' '{ printf "  would update  %s  (%s, %s)\n", $1, $3, $2 }'
else
  claude plugin marketplace update >/dev/null 2>&1 || echo "  ! marketplace update failed; versions may be stale"
  failed=""
  while IFS=$'\t' read -r id scope _; do
    out="$(claude plugin update "$id" --scope "$scope" 2>&1 </dev/null)" || failed+="  ! $id: $(echo "$out" | tail -1)"$'\n'
  done <<<"$before"
  after="$(versions)"
  changed="$(join -t $'\t' <(echo "$before" | cut -f1,3 | sort) <(echo "$after" | cut -f1,3 | sort) |
    awk -F'\t' '$2 != $3 { printf "  %s  %s → %s\n", $1, $2, $3 }')"
  if [ -n "$changed" ]; then echo "$changed"; else echo "  all $(echo "$before" | wc -l | tr -d ' ') plugins were already up to date"; fi
  printf '%s' "$failed"
fi

[ "$reload" = 1 ] || exit 0
echo "== Sessions"
if [ "${HERDR_ENV:-}" != 1 ]; then
  echo "  not inside Herdr: run /reload-plugins in each open session"
  exit 0
fi

herdr agent list | jq -r '.result.agents[] | select(.agent == "claude")
    | [.pane_id, .agent_status, .cwd, (.terminal_title_stripped // "")] | @tsv' |
while IFS=$'\t' read -r pane status cwd title; do
  name="$(basename "$cwd") ($pane)"
  if [ "$pane" = "${HERDR_PANE_ID:-}" ]; then
    echo "  this one  $name: run /reload-plugins here"
  elif [ "$status" != idle ] && [ "$status" != done ]; then
    echo "  skipped   $name: $status"
  elif [[ "$title" == *"claude agents" ]]; then
    echo "  skipped   $name: showing the agents screen, not a prompt"
  elif [ "$dry" = 1 ]; then
    echo "  would reload  $name"
  elif herdr agent prompt "$pane" "/reload-plugins" >/dev/null 2>&1; then
    echo "  reloaded  $name"
  else
    echo "  ! failed  $name"
  fi
done
