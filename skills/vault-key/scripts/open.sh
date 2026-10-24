#!/bin/bash
# open.sh <path> <KEY>...: start vault-key.sh in a terminal of the current Herdr workspace and bring
# the person there, so they type the values themselves. Prints the pane it used.
#
# It uses the workspace's `terminal` tab when its shell is at rest, and opens a tab `vault` otherwise.
# Needs HERDR_ENV=1 and jq.
set -euo pipefail

[ $# -ge 2 ] || { echo "usage: open.sh <path> <KEY>..."; exit 2; }
[ "${HERDR_ENV:-}" = 1 ] || { echo "✗ not inside Herdr: run it yourself: $(dirname "$0")/vault-key.sh $*"; exit 1; }
ws="${HERDR_WORKSPACE_ID:?}"
script="$(cd "$(dirname "$0")" && pwd)/vault-key.sh"

# A shell at rest titles its pane user@host:cwd; a running command (k9s, run projects) retitles it.
# Among the panes at rest, the one in the tab labelled `terminal` comes first.
terminal_tab=$(herdr tab list | jq -r --arg ws "$ws" '[.result.tabs[] | select(.workspace_id == $ws and .label == "terminal")][0].tab_id // ""')
pane=$(herdr pane list | jq -r --arg ws "$ws" --arg me "${HERDR_PANE_ID:-}" --arg tt "$terminal_tab" '
  [.result.panes[] | select(.workspace_id == $ws and .pane_id != $me and (.agent // "") == ""
                            and (.terminal_title_stripped | test("^[^ ]+@[^ ]+:")))]
  | sort_by(if .tab_id == $tt then 0 else 1 end) | .[0].pane_id // empty')
if [ -n "$pane" ]; then
  tab=$(herdr pane get "$pane" | jq -r '.result.pane.tab_id')
else
  created=$(herdr tab create --workspace "$ws" --label vault --cwd "$HOME" --no-focus)
  tab=$(printf '%s' "$created" | jq -r '.result.tab.tab_id')
  pane=$(printf '%s' "$created" | jq -r '.result.root_pane.pane_id')
  sleep 1   # let the new shell reach its prompt
fi

cmd="$(printf '%q ' "$script" "$@")"
herdr pane run "$pane" "$cmd" >/dev/null
herdr tab focus "$tab" >/dev/null
echo "$pane"
