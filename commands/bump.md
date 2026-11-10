---
description: Bump a plugin's version for Claude Code and Agent Plugins (asks patch, minor or major, with a recommendation from the diff), then ship it — commit, push, PR into main, auto-merge. Refuses to run on main.
argument-hint: "[patch|minor|major|x.y.z] [plugin name] [commit message]"
allowed-tools: Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git symbolic-ref:*), Bash(git fetch:*), Bash(git show:*), Bash(git add:*), Bash(git diff:*), Bash(git check-ignore:*), Bash(git ls-files:*), Bash(git commit:*), Bash(git push:*), Bash(git log:*), Bash(gh pr create:*), Bash(gh pr merge:*), Bash(gh pr view:*), Bash(gh auth status:*)
---

# Bump — Version a Plugin, Then Ship It

An installed plugin only updates when its `version` changes, so a change that ships without
a bump never reaches anyone. This command sets the new version, with the user's choice of
level, and then hands over to `/toolkits:ship`.

A plugin folder can ship for two platforms at once, and one bump releases it on both:

| Platform | Manifest | MCP servers |
|---|---|---|
| Claude Code | `.claude-plugin/plugin.json` | `.mcp.json` |
| Agent Plugins 1.0 ([agent-plugins.org](https://agent-plugins.org), used by Hermes Agent) | `plugin.json` | `mcp.json` |

All four files sit in the same plugin folder: the parent of `.claude-plugin/`. An Agent
Plugins manifest is a `plugin.json` at that folder's root whose `"$schema"` is
`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`. A `plugin.json` without that
`$schema` is not one: leave it alone.

The user may have supplied arguments: **$ARGUMENTS**

Read them loosely: `patch`, `minor`, `major` or an explicit `x.y.z` is the bump; a word that
matches a plugin's name picks the plugin; anything else is the commit message.

Run every step below in order. Stop and report to the user if any step fails.

## Step 1: Guard the branch

Get the current branch: `git rev-parse --abbrev-ref HEAD`.

**If it is `main` (or `master`), STOP.** Change nothing. Tell the user to create a branch
first (`git checkout -b <feature-name>`) and run the command again. Do this before the
bump, so that no version edit is left behind on main.

## Step 2: Find the plugin

List every manifest in the repository: `.claude-plugin/plugin.json` at the root and in any
subfolder (a marketplace repository can hold several plugins, for example one for each
folder under `mods/`).

Look at what changed: `git status --short`, and `git diff --stat origin/main...HEAD` for
commits that are not on main yet. A changed file belongs to the plugin whose folder is its
nearest parent with a manifest.

- One plugin has changes: that is the plugin.
- The user named a plugin: use it.
- Several plugins have changes and none was named: ask which ones to bump. Each gets its own
  level, and all of them ship together.
- No manifest at all: say that this is not a plugin repository and stop.
- Nothing changed and nothing to push: report "nothing to ship" and stop.

## Step 3: Read the versions

For the plugin, read two values:

- **current**: `version` in the manifest in the working tree.
- **released**: the same field on main, `git show origin/main:<path to plugin.json>` (run
  `git fetch origin main` first; if the file is not on main, the plugin is new and has no
  released version).

**If current is already higher than released**, the bump was done earlier on this branch. Do
not bump a second time. Tell the user "already at `<current>` (main is at `<released>`)" and
ask only if they want to keep it or choose another version.

A new plugin with no released version ships at the version it already has.

## Step 4: Recommend a level

Read the diff and pick the level that fits. Follow semantic versioning as it applies to a
plugin:

| Level | When |
|---|---|
| **patch** | a fix, a wording change in a skill or command, documentation, a default that changes |
| **minor** | something new: a skill, a command, a hook, a mod, an option, a new capability in an existing one |
| **major** | something that was there is removed or renamed, or behaves in a way that breaks how people use it |

While the version is `0.x`, a breaking change is a **minor** bump, and major is only for the
move to `1.0.0`, which the user must ask for.

## Step 5: Ask

If the arguments gave the bump, skip the question.

Otherwise ask once, with the AskUserQuestion tool. Put the recommended level first and mark
it "(Recommended)". Show the resulting version in each label, and the reason for the
recommendation in its description:

- `minor → 0.17.0 (Recommended)` — a new skill was added
- `patch → 0.16.2`
- `major → 1.0.0`

The user can also type a version. Refuse one that is not higher than **released**.

## Step 6: Write the version

Edit `version` in the plugin's `.claude-plugin/plugin.json`. Change that one line and keep the
formatting of the file.

If the plugin folder has an Agent Plugins manifest (`plugin.json` at its root, with the
Agent Plugins `$schema`), write the same new version into its `version` field, the same way.
This is a rule, not a search: the two platforms always release the same version. If that
manifest has a different version than the Claude Code one had before the bump, say so in the
report, and write the new version into both all the same.

Then search for other places that record the same version, and update each one you find:

- the plugin's entry in `.claude-plugin/marketplace.json`, if that entry has a `version` field
- a `package.json` in the plugin's folder, if its version matched the old one
- a changelog, if the repository keeps one: add an entry in the style of the existing ones

Do not add a `version` field where there was none.

## Step 7: Check the two platforms

Skip this step when the plugin folder has no Agent Plugins files (no `plugin.json` with the
Agent Plugins `$schema`, and no `mcp.json`).

**The files are tracked.** Run `git check-ignore -v <file>` on the plugin folder's
`plugin.json` and `mcp.json`. A match means the file never ships: many `.gitignore` files
have `**/mcp.json` with only `!plugin/.mcp.json` as an exception. Stop and report the rule
that matches, and the line to add (for example `!plugin/mcp.json`). Do not edit `.gitignore`
without the user's go-ahead.

**The required fields are there.** The Agent Plugins `plugin.json` needs `$schema`, `name` and
`version`, and only these top-level fields are allowed: `$schema`, `name`, `version`,
`description`, `author` (`name`, `email`, `url`), `homepage`, `repository`, `license`,
`keywords`, `extensions`. Its `name` must match the Claude Code manifest's `name`. An
`mcp.json` needs `"$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"` and a
`mcpServers` object.

**The MCP servers match.** Only when the folder has both `.mcp.json` and `mcp.json`. With one
of them alone, there is nothing to compare. The Claude Code `.mcp.json` holds its servers
either under `mcpServers` or at the top level; read both shapes.

- The two files list the same server names.
- For each server, the `type` maps from Claude Code to Agent Plugins as follows: `http` →
  `streamable-http`; `sse` → `sse`; `stdio` → `stdio`. A server with no `type` and a `url`
  counts as `http`; one with a `command` counts as `stdio`.
- For each server, `url` and `headers` are the same in both files (`command`, `args` and
  `env` for a stdio server).

On any mismatch, stop before shipping. Report each difference (server, field, the value in
`.mcp.json`, the value in `mcp.json`) and ask the user which one is right. Do not pick one.

## Step 8: Ship

Write the commit message, unless the user gave one: one subject line that says what changed
and ends with the new version in parentheses, as the history of this repository does, for
example `feat: a command that bumps a plugin and ships it (0.18.0)`. With several plugins,
name each with its version.

Then invoke the `toolkits:ship` skill with that message as its argument, and let it run its
own steps: stage, commit, push, pull request into main, merge. Do not repeat its steps here.

## Step 9: Report

Add one line to the report from ship: the plugin, the old version and the new one, and the
platforms it now releases on (Claude Code, and Agent Plugins when its manifest is there). Remind the
user that sessions already running keep the old version until `/plugin update` or a restart.
