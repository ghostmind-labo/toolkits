---
description: Enter learning mode for a subject — anchor to that subject's wiki workspace (its MCP), load the wiki and potion skills, report where the learning stands, and operate the wiki for the rest of the session.
argument-hint: "[subject, e.g. ai, chess, cooking]"
---

# Learn — Enter Learning Mode for a Subject

The user is starting (or resuming) a **learning session**. For the rest of this session, you are the maintainer of one subject's LLM-wiki: every source discussed gets ingested, every question answered from the wiki, every insight filed back. The subject: **$ARGUMENTS**

## Step 1: Load the operating knowledge

Invoke both skills now, before touching anything:

1. **`toolkits:wiki`** — the methodology: bootstrap/operate modes, the four meta notes, ingest/query/lint/sync, workspace targeting. This is the contract for *how* to learn.
2. **`potion:potion`** — the substrate: how notes, tags, files, links, and views work over the MCP, and the full rendering palette. Wiki pages should *use* that palette where it genuinely helps understanding — Mermaid diagrams for relationships and flows, `$...$` / `$$...$$` math, syntax-highlighted code blocks, tables, `::embed[URL]` for video sources, and live `html` blocks for interactive explainers (a timeline, a widget, a visualization). A learning wiki is allowed to be visual — markdown-first, richer when it teaches better.

## Step 2: Anchor to the subject's workspace

One wiki = one workspace = one MCP server (typically named `learning-<subject>`).

1. Match **$ARGUMENTS** to a connected wiki MCP (`mcp__learning-<subject>__*` tool prefix). If no argument was given, or several wiki MCPs are connected and the match is ambiguous, ask once — never guess which wiki receives writes.
2. Confirm the landing with `get_context` (the `workspace` header) before any write.
3. `find_note("Schema")`:
   - **Found** → this is an operating wiki. Read the Schema note in full — it is the authority for this workspace.
   - **Not found** → no wiki here yet. Offer to bootstrap (wiki skill, Mode 1), confirming the workspace is the intended one first.

## Step 3: Report where the learning stands

Before waiting for instructions, give the user a compact status so the session starts oriented:

- **Open questions** — read the Index note's `## Open questions` section. These are the subject's known gaps; surface them first — they are what to read next.
- **Pending sources** — ledger rows on the Sources note still `pending` (landed but never ingested): the ingest backlog.
- **Recent activity** — the last 2–3 entries in the Log note: what happened last session.
- **Shape** — roughly how many pages exist (the Pages view / `search_notes_by_tags(["page"])`) and which categories the Index shows.

Close the status with one suggested next step (ingest a pending source, tackle an open question, or — if the wiki is empty — "hand me your first source"). A suggestion, not a forced workflow.

## Step 4: Operate for the rest of the session

Follow the wiki skill's operate mode, with the session framed as *learning*:

- The user shares an article, video, PDF, or idea → that's an **ingest** (land it on the Sources ledger first).
- The user asks anything about the subject → that's a **query** (answer from pages, cite notes, file gaps to Open questions, offer to file syntheses back).
- The user wonders what to study next → read Open questions; if thin, run the lint's question-suggestion step.
- Sources were captured out-of-band since last time (Chrome clips tagged `source`, files attached in the app) → run a **sync** pass (see `/toolkits:wiki-sync`).
- Every change logs to the Log note, per the schema.

**Learning-mode defaults** (on top of the wiki skill):

- Prefer *teaching* answers: when a query answer would benefit from a diagram, draw the Mermaid; when a comparison would benefit from a table, build it — and offer to file these back as pages so the explanation compounds.
- When ingesting, briefly discuss key takeaways with the user before filing (their reactions shape emphasis) — this is a study session, not batch processing.
- End-of-session habit: if the conversation surfaced questions the wiki can't answer, make sure they landed in Open questions before the session closes.

## Rules

- All wiki-skill and Schema-note rules apply unchanged — this command adds framing, not exceptions.
- Never write to a workspace other than the anchored one; re-run the anchoring (Step 2) if the user switches subjects mid-session.
- If the subject's MCP is not connected at all, say so and stop — offer the `.mcp.json` entry the user needs to add rather than improvising against the wrong workspace.
