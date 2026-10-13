---
name: refresh-plugins
description: >-
  Update every installed Claude Code plugin at once, then make each Claude session open in
  Herdr reload its plugins and skills, so that a new version reaches all the sessions without
  restarting them one by one. Use this skill when the user runs /refresh-plugins or
  /toolkits:refresh-plugins, or says "update all my plugins", "upgrade the plugins everywhere",
  "reload the plugins in every session", "push the new version to all my sessions", "refresh
  every Claude session", or has just shipped a plugin and wants the open sessions to have it.
---

# Refresh plugins

A plugin that was just shipped reaches nobody until two things happen: the installed copy is
updated, and each running session loads it again. With ten sessions open, that is twenty
manual steps. One script does both.

```bash
"$SKILL_DIR/scripts/refresh.sh" --dry-run     # show what would be touched, change nothing
"$SKILL_DIR/scripts/refresh.sh"               # update, then reload the sessions
"$SKILL_DIR/scripts/refresh.sh" --no-reload   # update only
```

`SKILL_DIR` is this skill's folder. The script needs `jq`, and `HERDR_ENV=1` for the reload
part; outside Herdr it updates the plugins and says that the sessions are left to the user.

## What it does

1. **Updates.** It refreshes every marketplace, then runs `claude plugin update` for each
   enabled plugin that came from a marketplace. It reads the versions before and after, and
   prints only the plugins that changed (`toolkits 0.19.0 → 0.20.0`), or that all were up to
   date. A plugin that fails to update is listed with the reason; the others still go through.
2. **Reloads.** It lists the Claude sessions in Herdr and sends `/reload-plugins` to each one
   that is idle at its prompt.

## What it leaves alone

Typing into a session that is in the middle of something can answer a question that was not
the one asked, so the script only types into a session at rest. It skips, and lists:

- a session that is **working** or **blocked** on a question or a permission
- a session that shows the **agents screen** in place of a prompt, where text would start a
  new session
- **the session it runs from**: a session cannot type into itself in the middle of its turn

## How to run it

1. If the user did not ask to go straight ahead, run `--dry-run` first only when the list of
   sessions matters to them. Otherwise run it directly: updating is what they asked for.
2. Run the script and read its two sections.
3. Report in a few lines: the plugins that changed, the sessions reloaded, and the sessions
   skipped with the reason. For each skipped session, the user has to run `/reload-plugins`
   there, or run this again when the session is at rest.
4. End by reminding the user to type `/reload-plugins` in this session. You cannot do it for
   them.

What a reload does not cover: `/reload-plugins` loads skills, commands, agents and MCP
servers again. A change to a hook or a mod can need a restart of the session; say so when one
of the updated plugins ships hooks or mods.

Do not close, restart or start a session to apply an update. That is the user's call.
