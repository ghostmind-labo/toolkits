---
name: wiki
description: >-
  Bootstrap a personal, LLM-maintained wiki for a single subject (and its sub-subjects) as a
  ready-to-use Obsidian vault. The wiki is built around Obsidian — its [[wikilinks]], backlinks,
  and graph view are the interlinking system, not an afterthought. Use this skill whenever the
  user says things like "create a wiki", "start a wiki on X", "bootstrap a knowledge base",
  "set up a wiki for [topic]", "make me an Obsidian vault for X", "scaffold a wiki structure",
  or expresses interest in building a durable, growing notes system around one subject (with
  broad sub-topics) rather than capturing one-off notes. This skill only creates the structure
  — folders, an index, a changelog, and a schema document — never content. Also use when the
  user references Karpathy's LLM-wiki pattern or wants a "three-folder wiki".
---

# Wiki — Obsidian Vault Bootstrapper

This skill scaffolds an empty Obsidian vault for a single subject. The wiki is meant to grow over time as the user feeds in sources and asks questions — but at bootstrap time, only the structure exists. No content is invented.

The wiki is **Obsidian-native**: the interlinking that makes it a wiki — not a flat pile of notes — is Obsidian's `[[wikilink]]` syntax and the graph it produces. Backlinks, unresolved-link surfacing, and graph view are the discovery mechanism. Outside Obsidian the files are still plain markdown, but the system is designed to be opened and worked in inside Obsidian.

The pattern is adapted from Andrej Karpathy's LLM-wiki gist, kept deliberately minimal so iteration can refine it:

```
<subject>/
├── README.md          # what this wiki is, how to use it
├── index.md           # catalog of every page, organized by category
├── log.md             # append-only changelog of every ingest/edit
├── sources/           # raw inputs (PDFs, articles, transcripts, dumps)
├── pages/             # the wiki itself — markdown pages with [[wikilinks]]
└── meta/
    └── SCHEMA.md      # operating rules: conventions, page shape, workflows
```

Three folders, three top-level files. That's it.

## When invoked

Treat the invocation as a request to **initialize a new wiki**, not to populate one. The user's job is to provide the subject and a destination. This skill's job is to produce a vault they can immediately open in Obsidian and start filling.

## Inputs needed

Three things must be settled before creating anything:

1. **Subject** — a short, specific topic. Examples: "Edo period Japan", "Postgres internals", "Tarot history", "Personal finance basics". If the user gave a subject in their message, use it. If not, ask once.

2. **Vault mode** — one of:
   - **New vault** *(default, recommended)* — the wiki folder *is* the Obsidian vault. The user opens this folder directly in Obsidian. One subject = one vault. Cleanest separation, no collision with other notes.
   - **Inside an existing vault** — the wiki folder is created as a subfolder of an Obsidian vault the user already has. The vault root stays where it is; this wiki is one subject within it. Use only if the user explicitly says they have a vault they want this to live inside. Be aware: wikilinks resolve vault-wide in Obsidian, so page titles need to be unique enough not to collide with the rest of the vault.

3. **Destination path** — where to create the wiki folder:
   - For **new vault**: a parent directory; the wiki folder (named after the subject, kebab-cased) is created inside it and becomes the vault root. Default if unsure: current working directory.
   - For **inside an existing vault**: the absolute path to the existing vault. The wiki folder is created at the vault root (or a user-chosen subfolder within it).

Do not invent a subject. Do not silently pick a destination outside the cwd. If the user did not specify the vault mode, ask once with "new vault" as the default.

### The vault root question, explicitly

When creating a **new vault**, the structure is:

```
<destination>/<subject-slug>/    ← this folder IS the Obsidian vault root
├── README.md
├── index.md
├── log.md
├── sources/
├── pages/
└── meta/SCHEMA.md
```

The user opens `<destination>/<subject-slug>/` in Obsidian (File → Open vault → choose folder). The vault root and the wiki root are the same directory.

When linking **inside an existing vault**, the structure is:

```
<existing-vault-root>/           ← already an Obsidian vault, untouched
├── ...user's other notes...
└── <subject-slug>/              ← the new wiki, a subfolder
    ├── README.md
    ├── index.md
    ├── log.md
    ├── sources/
    ├── pages/
    └── meta/SCHEMA.md
```

The vault root stays where it was; the wiki is a folder inside it. The user does *not* re-open Obsidian — the new folder appears in the existing vault's file tree.

## How to create the structure

Use `mkdir -p` and the templates in `templates/` next to this SKILL.md. The four template files are placeholders with `{{SUBJECT}}` and `{{DATE}}` markers — substitute them when stamping out.

Step-by-step:

1. Resolve `<root>` = `<destination>/<subject-kebab-case>`.
2. Refuse to overwrite if `<root>` already exists with non-empty content. Tell the user, ask whether to pick a new name or merge.
3. Create directories: `<root>/sources`, `<root>/pages`, `<root>/meta`.
4. Stamp `README.md.template` → `<root>/README.md`.
5. Stamp `index.md.template` → `<root>/index.md`.
6. Stamp `log.md.template` → `<root>/log.md` with today's date as the first entry ("wiki created").
7. Stamp `SCHEMA.md.template` → `<root>/meta/SCHEMA.md`.
8. Drop a tiny `.gitkeep` in `sources/` and `pages/` so they survive `git init` empty.
9. Report what was created as a tree, with the absolute path.

The templates live in `templates/` — read them with the Read tool, substitute, and write with the Write tool. Substitutions:

| Marker | Replacement |
|--------|-------------|
| `{{SUBJECT}}` | the subject as the user phrased it (title case OK) |
| `{{SUBJECT_SLUG}}` | kebab-case version used in folder name |
| `{{DATE}}` | today's date, `YYYY-MM-DD` |

## What NOT to do at bootstrap

- Do not write any `pages/*.md` files. The wiki starts empty by design — pages are added later when the user ingests their first source.
- Do not pre-fill `index.md` with imagined sub-topics. The index is a catalog of *actual* pages, and there are none yet.
- Do not generate sample sources or pretend the user has uploaded anything.
- Do not research the subject. The skill is structure-only at this stage.

The reason: this wiki is for *one* user building knowledge on *one* subject. Fabricated structure ages worse than no structure — it bakes in assumptions the user hasn't made yet. An empty `pages/` and a one-line `index.md` invite the user to start cleanly.

## Obsidian is the runtime

This is an Obsidian vault first, a folder of markdown files second. Everything assumes Obsidian:

- **Wikilinks** — `[[Page Title]]` is the only link style. It's how the wiki becomes a wiki rather than a list. Obsidian resolves these to file paths, surfaces broken links, and builds the graph.
- **Backlinks** — Obsidian's backlinks pane is the primary way pages discover their incoming references. The schema's "See also" sections are written assuming the user can also see backlinks live.
- **Graph view** — the visible payoff of disciplined linking. The schema's lint pass exists partly to keep the graph honest.
- **Unresolved links** — Obsidian shows wikilinks pointing at non-existent pages. The schema's "dangling links" check leans on this.
- **Vault root** = `<root>/`. The user opens that folder in Obsidian — File → Open vault → choose folder.

Do not add a `.obsidian/` config directory — Obsidian creates it on first open. Do not add a non-Obsidian fallback link style (no `[markdown](links.md)` between pages); the consistency matters for the graph.

## Reporting back

After creating the structure, show:

1. The absolute path of the new vault.
2. A small directory tree (or `ls -R` style listing).
3. One next-step suggestion: "Drop your first source into `sources/`, then ask me to ingest it." — but only as a hint, not as a forced workflow.

## Future operations (not in scope here)

The schema document (`meta/SCHEMA.md`) describes three operations that will be relevant later: **ingest** (add a source, update pages, append to log), **query** (search pages, optionally file the answer back), and **lint** (find contradictions, orphans, stale claims). These are out of scope for the bootstrap skill — they belong to the wiki itself once it has pages. The schema documents them so the next Claude invocation working in the vault knows the rules.

## Resources

- **`templates/README.md.template`** — top-level README, explains the wiki to a future reader
- **`templates/index.md.template`** — catalog skeleton
- **`templates/log.md.template`** — changelog skeleton with the first entry
- **`templates/SCHEMA.md.template`** — operating rules for ingest/query/lint, the wikilink convention, the page shape
