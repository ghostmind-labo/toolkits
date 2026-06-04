---
description: Stage all changes, auto-write a commit message from the diff, push the current branch, open a PR into main, and auto-merge it. Refuses to run on main.
argument-hint: "[optional commit message]"
allowed-tools: Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git symbolic-ref:*), Bash(git add:*), Bash(git diff:*), Bash(git commit:*), Bash(git push:*), Bash(git log:*), Bash(gh pr create:*), Bash(gh pr merge:*), Bash(gh pr view:*), Bash(gh auth status:*)
---

# Ship — Solo-Dev Git Workflow

Take all work on the current branch from working tree to `main` in one command:
stage → commit → push → PR into `main` → auto-merge. Local `main` is never committed
to directly; everything flows through a pull request.

The user may have supplied a commit message as an argument: **$ARGUMENTS**

Run every step below in order. Stop and report to the user if any step fails — do not
silently continue.

## Step 1: Confirm prerequisites

- Confirm a git repository: `git rev-parse --is-inside-work-tree`. If this fails, tell
  the user this is not a git repo and stop.
- Confirm GitHub CLI is authenticated: `gh auth status`. If it fails, tell the user to
  run `gh auth login` and stop.

## Step 2: Determine and guard the branch

Get the current branch: `git rev-parse --abbrev-ref HEAD`.

**If the current branch is `main` (or `master`), STOP immediately.** Do not stage,
commit, or push. Tell the user: working directly on main is not allowed — create a
branch first with `git checkout -b <feature-name>`, then re-run `/git:ship`. This guard
is the whole point of the workflow; never bypass it.

Capture the branch name for later steps (referred to below as `<branch>`).

## Step 3: Stage everything

Stage all changes including new and deleted files:

```bash
git add -A
```

Then inspect what will be committed:

```bash
git status --short
git diff --cached --stat
```

**If there is nothing staged AND nothing to push** (working tree clean and the local
branch is not ahead of its remote), report "nothing to ship" and stop. There is no
point opening an empty PR.

If there is nothing staged but the branch has unpushed commits, skip the commit
(Step 4–5) and continue from the push (Step 6) — the existing commits still need to be
shipped.

## Step 4: Determine the commit message

- **If $ARGUMENTS is non-empty**, use that text verbatim as the commit message. Do not
  rewrite it.
- **If $ARGUMENTS is empty**, generate the message from the staged diff. Read the
  changes with `git diff --cached` (and `git diff --cached --stat` for the file list)
  and write a concise message:
  - One imperative subject line, ~50 chars, no trailing period
    (e.g. `add ship command to git plugin`).
  - If the change is non-trivial, add a blank line and 1–3 short bullet points
    describing what changed and why.
  - Optionally use a conventional-commit prefix (`feat:`, `fix:`, `docs:`, `chore:`,
    `refactor:`) when it fits naturally. Do not force it.

Summarize the diff faithfully — describe what the code actually does, not what the
user might have intended.

## Step 5: Commit

Commit using a HEREDOC so multi-line messages are preserved:

```bash
git commit -m "$(cat <<'EOF'
<subject line>

<optional body bullets>
EOF
)"
```

## Step 6: Push the current branch

```bash
git push -u origin <branch>
```

## Step 7: Open a pull request into main

Create the PR with the current branch as the source and `main` as the base. Reuse the
commit subject as the PR title and let `gh` build the body from commits:

```bash
gh pr create --base main --head <branch> --title "<subject line>" --fill
```

If a PR for this branch already exists, `gh pr create` will report that — in that case
skip creation and proceed to merge the existing PR. Capture the PR URL from the output.

## Step 8: Auto-merge into main

```bash
gh pr merge <branch> --merge
```

Notes:
- Use `--merge` (a standard merge commit) to stay faithful to the "merge into main"
  workflow. Do not delete the branch — the user keeps it.
- If the merge is blocked by required status checks or branch protection, do **not**
  force it. Report the blocker and the PR URL, and let the user decide (they can enable
  auto-on-pass with `gh pr merge <branch> --merge --auto`).

## Step 9: Report

Give the user a short summary:

- The branch shipped and the commit message used
- The PR URL
- Confirmation that it merged into `main` (or the blocker if it did not)

## Branching model reminder

This workflow assumes `main` is the single source of truth. To work on an isolated
feature over time, branch off `main` (`git checkout main && git pull && git checkout -b
my-feature`), commit freely, and only run `/git:ship` when ready. To keep a long-lived
feature branch current, pull from `main` (`git pull origin main`), not from any `dev`
branch.
