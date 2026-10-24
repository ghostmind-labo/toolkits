#!/bin/bash
# vault-key.sh <path> <KEY>...: ask for each key's value in this terminal, then write them all to
# Vault in one request. Run by a person, in their own terminal: the values never leave it.
#
#   vault-key.sh ghostmind/global/openrouter OPENROUTER_API_KEY
#   vault-key.sh ghostmind/project/potion/mcp GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET
#   vault-key.sh ghostmind/machine/m1 FILEVAULT_RECOVERY_KEY
#
# A path that exists is patched (its other keys stay); a new one is created. Values are read
# hidden, held only in this shell, and reach vault on stdin: never argv, a file or the history.
set -euo pipefail

path="${1:?usage: vault-key.sh <path> <KEY>...}"; shift
[ $# -gt 0 ] || { echo "usage: vault-key.sh <path> <KEY>..."; exit 2; }

case "$path" in
  ghostmind/global/*|ghostmind/project/*/*|ghostmind/machine/*) ;;
  *) echo "✗ $path is not a ghostmind/global/<provider>, ghostmind/project/<project>/<app> or ghostmind/machine/<host> path"; exit 2 ;;
esac
for k in "$@"; do
  [[ "$k" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "✗ $k is not a key name (UPPER_SNAKE_CASE)"; exit 2; }
done

vault token lookup >/dev/null 2>&1 || { echo "✗ Vault is not logged in here (VAULT_ADDR=${VAULT_ADDR:-unset})"; exit 1; }

existing=""; verb=put
if current=$(vault kv get -format=json "$path" 2>/dev/null); then
  existing=$(printf '%s' "$current" | /usr/bin/python3 -c 'import json,sys; print(" ".join(sorted(json.load(sys.stdin)["data"]["data"])))')
  unset current; verb=patch
  echo "Vault: $path (exists; it holds: ${existing:-nothing})"
else
  echo "Vault: $path (new)"
fi
[[ "$path" == */prod || "$path" == */prod/* ]] && echo "⚠ a prod path"
echo

values=()
for k in "$@"; do
  note=""; [[ " $existing " == *" $k "* ]] && note=" (replaces the current value)"
  while :; do
    read -rsp "$k$note: " v; echo
    [ -n "$v" ] && break
    echo "  empty; type it again, or Ctrl-C to stop"
  done
  echo "  ✓ ${#v} characters"
  values+=("$v")
done
unset v

echo
read -rp "Write ${#values[@]} key(s) to $path? [y/N] " ok
[[ "$ok" == [yY]* ]] || { values=(); echo "Nothing written."; exit 1; }

i=0
for k in "$@"; do printf '%s\0%s\0' "$k" "${values[$i]}"; i=$((i + 1)); done |
  /usr/bin/python3 -c '
import json, sys
p = sys.stdin.buffer.read().split(b"\0")[:-1]
print(json.dumps({p[i].decode(): p[i + 1].decode() for i in range(0, len(p), 2)}))' |
  vault kv "$verb" "$path" - >/dev/null
values=()

echo "✓ vault kv $verb $path"
vault kv get -format=json "$path" | /usr/bin/python3 -c '
import json, sys
for k, v in sorted(json.load(sys.stdin)["data"]["data"].items()):
    print(f"  {k}  {len(str(v))} characters")'
