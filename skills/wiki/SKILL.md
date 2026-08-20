---
name: wiki
description: >-
  Construct, operate, or improve a personal LLM-maintained wiki ("second brain") built as an
  Obsidian vault, following Karpathy's LLM-wiki pattern (sources → wiki pages → schema). This
  skill should be used when the user asks to "create a wiki", "start a wiki on X", "bootstrap
  a knowledge base", "make me an Obsidian vault for X", "build a second brain", "ingest this
  source / article / PDF into my wiki", "ask my wiki", "lint my wiki", "check my wiki's health",
  "audit my second brain", "improve my vault", "upgrade my notes to the Karpathy pattern", or
  "turn my existing notes into a second brain". Covers the full lifecycle: creating a new vault,
  running ingest/query/lint operations inside one, and retrofitting the pattern onto an existing
  vault or notes folder.
---

# Wiki — LLM-Maintained Second Brain (Obsidian)

This skill makes an AI agent a competent maintainer of a personal wiki built on Andrej Karpathy's LLM-wiki pattern: a three-layer system where **raw sources** (immutable inputs) are compiled into a **wiki** (interlinked markdown pages the LLM owns) governed by a **schema** (the operating contract). The human sources documents and asks questions; the LLM does all the bookkeeping — summarizing, cross-referencing, reconciling, linting. The wiki is a persistent, compounding artifact: cross-references are already there, contradictions already flagged, synthesis already reflects everything read.

The canonical layout:

```
<subject>/
├── README.md          # what this wiki is, how to use it
├── index.md           # catalog of every page, organized by category
├── log.md             # append-only changelog: ## [YYYY-MM-DD] op | summary
├── sources/           # raw inputs, read-only (PDFs, articles, transcripts)
├── pages/             # the wiki — markdown pages with [[wikilinks]]
└── meta/
    └── SCHEMA.md      # operating rules: conventions, page shape, workflows
```

Obsidian is the runtime: `[[wikilinks]]` are the only link style between pages, and backlinks, unresolved-link surfacing, and graph view are the discovery and honesty mechanisms. Outside Obsidian the files are still plain markdown.

## Choosing the mode

Determine which of three modes the request calls for:

| Mode | When | Reference |
|------|------|-----------|
| **Bootstrap** | No wiki exists yet; user wants to start one for a subject | `references/bootstrap.md` |
| **Operate** | A wiki exists; user wants to ingest a source, ask a question, or run a health check | `references/operations.md` |
| **Audit & upgrade** | User has an existing vault/notes system (this pattern or not) and wants it assessed or improved | `references/audit.md` |

Detection rules:

- Mentions of creating, starting, or scaffolding → **Bootstrap**.
- A `meta/SCHEMA.md` (or `CLAUDE.md` acting as schema) exists in the target folder, and the request is about content → **Operate**.
- The user points at pre-existing notes — an Obsidian vault, a folder of markdown, a PARA or Zettelkasten setup — and asks to improve, restructure, assess, or "make it a second brain" → **Audit & upgrade**.
- Ambiguous ("set up my second brain" over a folder that already has notes) → look at the folder first; if it has real content, treat as audit, not bootstrap. Never scaffold on top of existing notes without an audit.

Read the matching reference file before acting. Do not run operations from memory of this SKILL.md alone — the references carry the procedures.

## Mode 1 — Bootstrap (construct)

Create the structure only, never content. Settle three inputs: **subject** (short, specific — ask once if missing), **vault mode** (new standalone vault, the default, or a subfolder inside an existing vault), and **destination path** (default: current working directory). Stamp the four templates in `templates/` (substituting `{{SUBJECT}}` and `{{DATE}}`), create `sources/`, `pages/`, `meta/`, and report the tree.

At bootstrap, do NOT: write any `pages/*.md`, pre-fill `index.md` with imagined sub-topics, generate sample sources, or research the subject. Fabricated structure ages worse than no structure. The full procedure, including vault-root layout diagrams and the overwrite-refusal rule, is in **`references/bootstrap.md`**.

**Many vaults, one standard.** One subject = one vault, and a user may accumulate many (one per niche subject they're learning). Bootstrap every vault identically from the same templates — this skill is the shared standard, so any agent can open any of the user's vaults, read its `meta/SCHEMA.md`, and operate it with no hand-off. Per-vault divergence lives in that vault's schema, never in improvised structure.

## Mode 2 — Operate (ingest / query / lint)

The day-to-day loop inside an existing wiki. **The vault's own `meta/SCHEMA.md` is the authority** — read it first; where it conflicts with this skill's defaults, the vault's schema wins. The three operations:

- **Ingest** — a new source lands in `sources/`; read it, then update every page it touches (typically 5–15): edit existing pages in place (write-back, not append-only), create pages only for genuinely new entities/concepts, update `index.md` (resolving any open question the source answers), append a parseable `log.md` entry.
- **Query** — answer from `pages/` with page citations; offer to file novel synthesis back into the wiki so answers compound. Gaps the wiki can't answer are filed under **Open questions** in `index.md`.
- **Lint** — periodic health check: contradictions (reconcile by source recency), stale claims, orphans, dangling links, missing cross-references, compression-trap pages, single-source load-bearing claims. Report, propose, apply what the user approves — and end by suggesting the 2–3 questions or sources that would most strengthen the wiki.

Detailed procedures, the log-entry format, contradiction-reconciliation rules, and synthesis-page guidance are in **`references/operations.md`**.

## Mode 3 — Audit & upgrade (improve)

Assess an existing second brain — whether built by this skill, hand-rolled from Karpathy's gist, or a plain Obsidian vault — and bring it up to the pattern. The flow: inventory the vault, score it against the pattern's checklist (source/wiki separation, index, log, schema, link discipline, page shape), report findings, then retrofit the missing pieces in safe order with user approval.

Hard safety rules: snapshot first (`git init` + commit, or confirm existing VCS), never move or rewrite the user's original notes without explicit approval, map existing structures (PARA, Zettelkasten, daily notes) onto the pattern rather than forcing a restructure. The audit checklist, scoring rubric, and retrofit sequence are in **`references/audit.md`**.

## Principles (all modes)

- **Division of labor** — the human sources, directs, and decides; the agent does the bookkeeping. Never invent sources or facts. A claim without backing in `sources/` is marked `(no source yet)` and surfaced at the next lint.
- **Write-back over append-only** — when new information arrives about an entity or concept that has a page, update that page. Do not accumulate parallel near-duplicate pages that only backlinks connect.
- **Reversible changes** — every operation appends to `log.md` with the format `## [YYYY-MM-DD] <op> | <summary>` plus affected pages, so any pass can be located and undone. Destructive actions (deleting pages, merging, moving user files) are proposed, not silently applied.
- **AI-first pages** — pages are optimized for the *next agent* as much as the human: consistent shape, frontmatter with type/tags/updated, sources cited in a Sources section, self-contained context, explicit recency markers. See the page shape in `meta/SCHEMA.md` (stamped from `templates/SCHEMA.md.template`).
- **Obsidian-native linking** — `[[wikilinks]]` only between pages; no markdown-path links. Do not create a `.obsidian/` directory — Obsidian generates it on first open. The consistent `type`/`tags`/`updated` frontmatter also makes pages queryable with Obsidian's core **Bases** plugin (tables/views over frontmatter) — worth mentioning to the user, never a dependency.
- **Open questions compound too** — the wiki tracks what it *cannot* answer (an `## Open questions` section in `index.md`): queries that hit gaps and lint passes add entries; ingests resolve them. For a learning vault this is the growth engine — the wiki tells the user what to read next.
- **Schema co-evolves** — when a convention repeatedly proves awkward during operate/audit passes, propose a schema amendment rather than silently deviating.

## Resources

### Reference files

- **`references/bootstrap.md`** — full bootstrap procedure: inputs, vault-root layouts, template stamping, overwrite handling
- **`references/operations.md`** — ingest / query / lint / synthesis procedures, log format, reconciliation rules
- **`references/audit.md`** — auditing an existing vault: inventory, scorecard, retrofit sequence, migration safety

### Templates (stamped at bootstrap, reused when retrofitting)

- **`templates/README.md.template`** — vault README
- **`templates/index.md.template`** — catalog skeleton
- **`templates/log.md.template`** — changelog skeleton with parseable entry format
- **`templates/SCHEMA.md.template`** — the operating contract: page shape, frontmatter, the three operations, conventions
