# Bootstrap — Creating a New Wiki Workspace

Full procedure for Mode 1. Bootstrap creates **structure only, never content**. Everything happens over the Potion MCP.

## Inputs to settle first

1. **Subject** — a short, specific topic. Examples: "Edo period Japan", "Postgres internals", "Tarot history". If the user gave a subject, use it. If not, ask once. Do not invent one.

2. **Workspace** — one subject = one workspace. Two cases:
   - **The MCP is already pinned to the right workspace** — project MCP configs often pass a `workspace` header (check `get_context`; a header pin overrides the default workspace for *every* call, so `set_default_workspace` cannot escape it). If the connected workspace is empty (or holds nothing but leftovers the user confirms are disposable), bootstrap into it.
   - **A new workspace is needed** — `create_workspace` named for the subject, then `set_default_workspace` so subsequent calls land in it. This only works when no `workspace` header pins the connection.

   **Never bootstrap into a workspace that already has real content without the user confirming.** If `search_notes` or `find_note` show existing notes, stop and ask — the titles this bootstrap needs (`Index`, `Sources`, `Log`, `Schema`) must be unambiguous, and existing content may deserve its own structure.

## Creation steps

Read each template with the Read tool, substitute the markers, create with `create_note`:

| Marker | Replacement |
|--------|-------------|
| `{{SUBJECT}}` | the subject as the user phrased it (title case OK) |
| `{{DATE}}` | today's date, `YYYY-MM-DD` |

1. **Index** — `create_note` from `templates/index-note.md.template`: title exactly `Index`, `tags: ["meta"]`.
2. **Sources** — from `templates/sources-note.md.template`: title exactly `Sources`, `tags: ["meta"]`.
3. **Log** — from `templates/log-note.md.template`: title exactly `Log`, `tags: ["meta"]`. Its first entry is the bootstrap entry (the template carries it).
4. **Schema** — from `templates/schema-note.md.template`: title exactly `Schema`, `tags: ["meta"]`.

   **The exact short titles are the link handles** — `[[Index]]`, `[[Sources]]`, `[[Log]]`, `[[Schema]]` resolve by exact title. Aliases cannot be set over the MCP; the user may add them in the UI later, and `[[alias]]` links then also work. The templates already cross-reference each other — links may be written before their targets exist, so creation order does not matter; they resolve as the notes land.

5. **Quick Access** — `add_to_quick_access` for Index, Sources, and Log (in that order). Sensible icons if desired (e.g. `list` for Index, `database` for Sources, `history` for Log); never required.
6. **Pages view** — `create_view`: name `Pages`, `type: "feed"`, `tags: ["page"]`, `sort_by: "updated_at"`, `sort_direction: "desc"`. It matches nothing yet — pages appear in it as they are created.
7. **Verify** — `list_quick_access` should show the three pins; `lint_links` should report **0 dangling, 0 orphans**. (A self-referencing link — e.g. `[[Log]]` written inside the Log note — does not resolve and shows as dangling; the templates avoid this by writing "this note"/"this log" instead. If lint reports one, that's the cause.)

## What NOT to do at bootstrap

- Do not create any wiki pages (`page`-tagged notes). The wiki starts empty by design — pages appear when the first source is ingested.
- Do not pre-fill the Index with imagined categories. The index catalogs *actual* pages; there are none yet.
- Do not add rows to the Sources ledger or pretend the user has provided anything.
- Do not research the subject. Bootstrap is structure-only.
- Do not create tags ahead of use — tags exist by being attached; `page`, `concept`, etc. appear with the first real page.

The reason: fabricated structure ages worse than no structure — it bakes in assumptions the user hasn't made yet. An empty Pages view and a one-line Index invite a clean start.

## Reporting back

After creating the structure, show:

1. The workspace name and the four notes created (with their ids).
2. What's pinned to the sidebar and the Pages view.
3. One next-step hint: "Hand me your first source — a URL, a PDF, or pasted text — and ask me to ingest it." — a hint, not a forced workflow.
