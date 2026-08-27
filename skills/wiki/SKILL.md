---
name: wiki
description: >-
  Construct or operate a personal LLM-maintained wiki ("second brain") built inside a Potion
  workspace, following Karpathy's LLM-wiki pattern (sources → wiki pages → schema) over the Potion
  MCP. This skill should be used when the user asks to "create a wiki", "start a wiki on X",
  "bootstrap a knowledge base", "make me a wiki workspace for X", "build a second brain",
  "ingest this source / article / PDF into my wiki", "ask my wiki", "lint my wiki", "check my
  wiki's health", or "audit my second brain". Covers the full lifecycle: bootstrapping a new
  subject workspace (Index, Sources, Log, Schema notes + Quick Access + views) and running
  ingest/query/lint/sync operations inside one, including reconciling sources captured out-of-band (Chrome-extension clips tagged "source", files attached in the UI) into the Sources ledger.
---

# Wiki — LLM-Maintained Second Brain (Potion)

This skill makes an AI agent a competent maintainer of a personal wiki built on [Andrej Karpathy's LLM-wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f): a three-layer system where **raw sources** (immutable inputs) are compiled into a **wiki** (interlinked pages the LLM owns) governed by a **schema** (the operating contract). The human sources documents and asks questions; the LLM does all the bookkeeping — summarizing, cross-referencing, reconciling, linting. The wiki is a persistent, compounding artifact: cross-references are already there, contradictions already flagged, synthesis already reflects everything read.

The substrate is **Potion**, driven entirely over its MCP. Everything is a note — there are no folders. Structure comes from **tags**, **titles**, **links**, **Quick Access**, and **views**. Read the `potion` skill for the tool-level details; this skill assumes it.

## The canonical shape of a wiki workspace

**One subject = one Potion workspace.** Inside it, four meta notes (all tagged `meta`; their **exact short titles are the stable link handles**) plus the wiki pages:

| Note title | Quick Access | Role |
|------------|:---:|------|
| **Index** | ✅ | Catalog of every page by category + `## Open questions` |
| **Sources** | ✅ | The raw layer: files attached here, body = ledger table of every source with type, date, description, status |
| **Log** | ✅ | Append-only changelog: `## [YYYY-MM-DD] op | summary` |
| **Schema** | — | The operating contract — page shape, conventions, the three operations |

Wiki pages are notes tagged **`page`** plus a type tag: `concept`, `entity`, `source-summary`, or `synthesis`. A "Pages" view (feed over tag `page`, sorted by `updated_at` desc) is the browsing surface. Notes link with `[[wikilinks]]` — prefer `[[Name|uuid]]` once the id is known; `lint_links` and `list_note_links` are the honesty mechanisms (dangling links, orphans, backlinks).

**Potion constraints every operation respects:**

- `[[file:name.pdf]]` refs only resolve on the note the file is attached to → **pages never use file refs**; they cite sources by name with a link to `[[Sources]]` (or the source's own note).
- There is no append API — appending to the Log means `read_note` → `update_note` with the entry added at the bottom. Never drop existing entries.
- `list_notes` caps at 30 → scan with `search_notes` / `search_notes_by_tags` instead.
- Tag filters are AND, not OR.
- Aliases cannot be set over the MCP (`create_note`/`update_note` expose no alias field) — the meta notes' exact short titles (`Index`, `Sources`, `Log`, `Schema`) are the link handles instead; unambiguous because one workspace = one subject. The user may add aliases in the UI; if present, `[[alias]]` links also work.
- A note linking to itself does not resolve — self-references stay dangling; write "this note" instead.
- Wikilink syntax mentioned in prose becomes a real link — wrap it in backticks unless a link is intended.

## Choosing the mode

| Mode | When | Reference |
|------|------|-----------|
| **Bootstrap** | No wiki workspace exists yet; user wants to start one for a subject | `references/bootstrap.md` |
| **Operate** | A wiki workspace exists; user wants to ingest a source, ask a question, or run a health check | `references/operations.md` |

Detection: mentions of creating, starting, or scaffolding → **Bootstrap**. A note titled `Schema` exists in the connected workspace and the request is about content → **Operate**. If unsure, check `find_note("Schema")` — a workspace with the four meta titles is an operating wiki. Never bootstrap into a workspace that already has content without confirming with the user.

Read the matching reference file before acting. Do not run operations from memory of this SKILL.md alone — the references carry the procedures.

## Mode 1 — Bootstrap (construct)

Create the structure only, never content. Settle two inputs: **subject** (short, specific — ask once if missing) and **workspace** (create a new one named for the subject, or use the already-connected one — confirm which). Then: create the four meta notes from `templates/` (substituting `{{SUBJECT}}` and `{{DATE}}`; exact titles `Index`, `Sources`, `Log`, `Schema`), pin Index + Sources + Log to Quick Access, create the "Pages" view, and verify with `lint_links`.

At bootstrap, do NOT: create any wiki pages, pre-fill the Index with imagined categories, invent sample sources, or research the subject. Fabricated structure ages worse than no structure. Full procedure in **`references/bootstrap.md`**.

**Many wikis, one standard.** The user accumulates one workspace per niche subject they're learning. Bootstrap every one identically from the same templates — this skill is the shared standard, so any agent can connect to any wiki workspace, read its Schema note, and operate it with no hand-off. Per-wiki divergence lives in that workspace's Schema note, never in improvised structure.

## Mode 2 — Operate (ingest / query / lint)

The day-to-day loop inside an existing wiki workspace. **The workspace's own Schema note is the authority** — read it first (`find_note("Schema")`); where it conflicts with this skill's defaults, the Schema note wins. The three operations:

- **Ingest** — a source arrives (URL, PDF, pasted text, clipped article); land it on the Sources note (attach + ledger row), read it through the file tools, then update every page it touches (typically 5–15): edit existing pages in place (write-back, not append-only), create pages only for genuinely new entities/concepts, update the Index (resolving any open question the source answers), append a Log entry, flip the ledger row to `ingested`.
- **Query** — answer from wiki pages with note citations; offer to file novel synthesis back as a `synthesis` page so answers compound. Gaps the wiki can't answer are filed under `## Open questions` on the Index.
- **Sync** — reconcile the Sources ledger with reality: sources captured out-of-band (a note clipped with the Chrome extension and tagged `source`, a file attached in the UI) get their missing ledger rows; orphan and stuck-`pending` rows get flagged. The `source` tag is the capture convention; the ledger is the catalog; sync makes them agree. Exposed as the `/toolkits:wiki-sync` command.
- **Lint** — periodic health check: `lint_links` for dangling links and orphans, plus contradictions (reconcile by source recency), stale claims, missing cross-references, index drift, single-source load-bearing claims, open-question drift. Report, propose, apply what the user approves — and end by suggesting the 2–3 questions or sources that would most strengthen the wiki.

Detailed procedures, the log-entry format, contradiction-reconciliation rules, and synthesis-page guidance are in **`references/operations.md`**.

## Principles (all modes)

- **Division of labor** — the human sources, directs, and decides; the agent does the bookkeeping. Never invent sources or facts. A claim without backing in the Sources ledger is marked `(no source yet)` and surfaced at the next lint.
- **Write-back over append-only** — when new information arrives about an entity or concept that has a page, update that page. Do not accumulate parallel near-duplicate notes that only backlinks connect.
- **Reversible changes** — every operation appends to the Log with the format `## [YYYY-MM-DD] <op> | <summary>` plus affected pages. Destructive actions (deleting notes or files, merging) are proposed, not silently applied.
- **AI-first pages** — pages are optimized for the *next agent* as much as the human: consistent shape, type tags, self-contained summary paragraph, sources cited in a Sources section, explicit recency markers. The page shape lives in the Schema note (stamped from `templates/schema-note.md.template`).
- **Open questions compound too** — the wiki tracks what it *cannot* answer (`## Open questions` on the Index): queries that hit gaps and lint passes add entries; ingests resolve them. For a learning wiki this is the growth engine — the wiki tells the user what to read next.
- **Sources are readable, not just stored** — attachments are text-extracted and indexed; read them with `describe_file` → `read_file` / `search_file`, a few pages at a time, never whole.
- **Schema co-evolves** — when a convention repeatedly proves awkward, propose an amendment to the workspace's Schema note rather than silently deviating. Upgrading an older wiki = diff its Schema note against the current template and propose adopting what's missing, never rewrite it wholesale.

## Resources

### Reference files

- **`references/bootstrap.md`** — full bootstrap procedure: workspace resolution, note creation, Quick Access, views, lint verification
- **`references/operations.md`** — ingest / query / lint / synthesis procedures, log format, reconciliation rules

### Templates (note bodies stamped at bootstrap)

- **`templates/index-note.md.template`** — the Index note: catalog skeleton + Open questions
- **`templates/sources-note.md.template`** — the Sources note: ledger table
- **`templates/log-note.md.template`** — the Log note: changelog skeleton with parseable entry format
- **`templates/schema-note.md.template`** — the Schema note: the operating contract
