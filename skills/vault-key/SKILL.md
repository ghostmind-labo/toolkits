---
name: vault-key
description: >-
  Add or update keys in Vault without the values ever passing through the conversation: Claude
  works out the path and the key names, then starts a small prompt in a terminal tab of the
  current Herdr workspace where the person types each value hidden, and one request writes them
  all. Use when the user runs /vault-key, or says "add a key to Vault", "put this secret in Vault",
  "I need to store a key for <project>", "add a global key", "update the prod key of X",
  "rotate this secret", or is about to paste a secret into the chat.
---

# Vault key

The person types the values, in their own terminal. Claude decides **where** they go and
**which names** they get, and never sees, asks for, reads back or echoes a value.

```bash
"$SKILL_DIR/scripts/open.sh" <path> <KEY>...       # start the prompt in a terminal tab and go there
"$SKILL_DIR/scripts/vault-key.sh" <path> <KEY>...  # the prompt itself; outside Herdr, hand the user this line
```

`SKILL_DIR` is this skill's folder; pass the absolute path.

## Steps

1. **Pick the path.** The `system` plugin's `secrets` skill has the rules; in short:

   | The value serves | Path |
   |---|---|
   | several products (one provider's key) | `ghostmind/global/<provider>` |
   | one app, every environment | `ghostmind/project/<project>/<app>` |
   | one app, dev or prod only | `ghostmind/project/<project>/<app>/dev` or `…/prod` |
   | one machine (a FileVault recovery key, a device's own login) | `ghostmind/machine/<host>`, the host's Tailscale name (`m1`, `rpi`, `node-1`) |

   A machine's secrets are read by no app; they are there to be found when the machine is not.

   Look before choosing: `vault kv list ghostmind/global`, or `ghostmind/project/<project>`, and the
   key names a path already holds (names only):
   `vault kv get -format=json <path> | jq -r '.data.data | keys[]'`.

2. **Pick the names.** UPPER_SNAKE_CASE, matching the `.env.schema` item that will read it
   (`grep -r <NAME> /Volumes/Projects/<project>/**/.env.schema`), or the name the schema's
   `path#KEY` points to. Reuse an existing name rather than adding a near-twin.

3. **Say it in one line** (path, names, and new or replacing) and start it:
   `open.sh <path> <KEY>...`. It runs in the workspace's `terminal` tab when that shell is at rest,
   in a new `vault` tab otherwise, and moves the person there.

4. **Tell the person to type the values in that tab.** Each one is hidden, then shown as a length.
   Empty is refused. Nothing is written until they answer `y`.

5. **Check it landed**, by name and length only:
   `vault kv get -format=json <path> | jq -r '.data.data | to_entries[] | "\(.key) \(.value|length)"'`.
   Then the place that reads it (a schema line, a `varlock load`) if there is one.

## What the prompt does

- A path that exists is **patched**: its other keys stay. A new path is **created**.
- It shows which keys the path already holds and marks the ones being replaced. A path ending in
  `/prod` is flagged.
- Values reach `vault` on stdin as JSON: never in argv, a file or the shell history.
- It refuses a path outside `ghostmind/global/`, `ghostmind/project/<project>/<app>` and
  `ghostmind/machine/<host>`, a key name that is not UPPER_SNAKE_CASE, and a shell where Vault is
  not logged in.

## Traps

| What you see | Why | What to do |
|---|---|---|
| The person pastes the value into the chat | Habit | Do not use it or repeat it. Run the prompt anyway, and say the pasted value is now in the transcript: rotate it if it matters |
| A secret shown once on a web page (an OAuth client) | It must not go through the chat either | Copy it with the page's button, paste it at the hidden prompt, then empty the clipboard: `printf '' \| pbcopy` |
| `✗ Vault is not logged in here` | The terminal has no `VAULT_TOKEN` / `VAULT_ADDR` | The person logs in in that tab, then runs the line again (it is in their shell history) |
| A dev session cannot write `…/prod` | The dev policy reads dev paths only | Expected: the person's own token can. Ask before writing prod |
| Renaming or removing a global key | Other projects read it | Never from here. Add the new name beside the old one (`secrets` skill) |
