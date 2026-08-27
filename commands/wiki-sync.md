---
description: Reconcile a wiki workspace's Sources ledger with reality — find source-tagged notes and attachments missing from the table, flag orphan rows and pending ingests.
argument-hint: "[optional: workspace hint]"
---

# Wiki Sync — Sources Ledger Reconciliation

Reconcile the connected Potion wiki workspace's **Sources ledger** against what actually exists. Sources arrive out-of-band — a note clipped with the Chrome extension and tagged `source`, a file attached directly in the UI — and the ledger drifts. This command finds the drift and fixes it with the user's approval.

This is the **sync** operation of the `wiki` skill. Read that skill first (`skills/wiki/`, especially `references/operations.md` § Sync) — the workspace's own Schema note remains the authority. The Potion MCP is the interface; the user may have hinted at a workspace: **$ARGUMENTS**

## Steps

1. **Confirm the workspace is a wiki.** `find_note("Schema")` and `find_note("Sources")` — if either is missing, this is not a bootstrapped wiki workspace; say so and stop. Read the Sources note and parse its ledger table.

2. **Collect reality, three ways:**
   - **Attachments:** `list_files()` (workspace-wide) — every file, with the note it's attached to.
   - **Source notes:** `search_notes_by_tags(["source"])` — every note carrying the `source` tag.
   - **Recent captures:** `list_notes` sorted newest-first — recently created notes that *look* like sources (clipped articles: a source line + article body) but were never tagged `source`. Candidates only, never auto-classified.

3. **Diff against the ledger:**
   - **Missing rows** — attachments (on any note) and `source`-tagged notes with no ledger row.
   - **Orphan rows** — ledger rows whose file ref or wikilink points at nothing that exists.
   - **Stuck rows** — rows still `pending` (landed but never ingested).
   - **Untagged candidates** — from step 2c: notes that look like sources but carry no `source` tag and no row.

4. **Report first, then fix what the user approves:**
   - Add missing rows to the ledger (`update_note` on Sources): name (`[[file:...]]` only if attached to the Sources note itself; `[[Title|uuid]]` for notes and for files attached elsewhere, noting which note holds the file), type, date (the note/file's created date), one-line description, status `pending`.
   - For approved untagged candidates: add the `source` tag (keep existing tags — `update_note` replaces the whole tag set) and a ledger row.
   - Propose removal for orphan rows; never delete silently.
   - List `pending` rows as ingest candidates — offer to ingest, don't start unasked.

5. **Log it.** Append a `sync` entry to the Log note (read → append at bottom → update): rows added, rows flagged, candidates tagged. If nothing drifted, report clean and skip the log entry.

## Rules

- Report → approve → apply. Never mass-tag or mass-delete without the user seeing the list.
- The ledger row is the catalog; the `source` tag is the capture convention. Both must agree when sync finishes.
- Sources stay immutable — sync touches the ledger, tags, and Log, never the content of a source itself.
