# Bootstrap — Creating a New Wiki Vault

Full procedure for Mode 1. Bootstrap creates **structure only, never content**.

## Inputs to settle first

1. **Subject** — a short, specific topic. Examples: "Edo period Japan", "Postgres internals", "Tarot history", "Personal finance basics". If the user gave a subject, use it. If not, ask once. Do not invent one.

2. **Vault mode** — one of:
   - **New vault** *(default, recommended)* — the wiki folder *is* the Obsidian vault. One subject = one vault. Cleanest separation, no collision with other notes.
   - **Inside an existing vault** — the wiki folder is created as a subfolder of a vault the user already has. Use only if the user explicitly says so. Caution: wikilinks resolve vault-wide in Obsidian, so page titles must be unique enough not to collide with the rest of the vault.

3. **Destination path**:
   - For **new vault**: a parent directory; the wiki folder (subject, kebab-cased) is created inside it and becomes the vault root. Default if unsure: current working directory.
   - For **inside an existing vault**: the absolute path to the existing vault; the wiki folder is created at the vault root (or a user-chosen subfolder).

Do not silently pick a destination outside the cwd. If vault mode was not specified, ask once with "new vault" as the default.

## Vault root layouts

**New vault** — the wiki root and the vault root are the same directory:

```
<destination>/<subject-slug>/    ← this folder IS the Obsidian vault root
├── README.md
├── index.md
├── log.md
├── sources/
├── pages/
└── meta/SCHEMA.md
```

The user opens `<destination>/<subject-slug>/` in Obsidian (File → Open vault → choose folder).

**Inside an existing vault** — the vault root stays untouched:

```
<existing-vault-root>/           ← already an Obsidian vault
├── ...user's other notes...
└── <subject-slug>/              ← the new wiki, a subfolder
    ├── README.md
    ├── index.md
    ├── log.md
    ├── sources/
    ├── pages/
    └── meta/SCHEMA.md
```

The user does *not* re-open Obsidian — the folder appears in the existing vault's file tree.

## Creation steps

1. Resolve `<root>` = `<destination>/<subject-kebab-case>`.
2. **Refuse to overwrite** if `<root>` already exists with non-empty content. Tell the user, and ask whether to pick a new name — or switch to **audit & upgrade mode** (`references/audit.md`) if the existing content is a notes system they want improved.
3. Create directories: `<root>/sources`, `<root>/pages`, `<root>/meta`.
4. Stamp `templates/README.md.template` → `<root>/README.md`.
5. Stamp `templates/index.md.template` → `<root>/index.md`.
6. Stamp `templates/log.md.template` → `<root>/log.md` (first entry: bootstrap).
7. Stamp `templates/SCHEMA.md.template` → `<root>/meta/SCHEMA.md`.
8. Drop a `.gitkeep` in `sources/` and `pages/` so they survive `git init` empty.
9. Report what was created as a tree, with the absolute path.

Read templates with the Read tool, substitute markers, write with the Write tool:

| Marker | Replacement |
|--------|-------------|
| `{{SUBJECT}}` | the subject as the user phrased it (title case OK) |
| `{{DATE}}` | today's date, `YYYY-MM-DD` |

## What NOT to do at bootstrap

- Do not write any `pages/*.md` files. The wiki starts empty by design — pages appear when the first source is ingested.
- Do not pre-fill `index.md` with imagined sub-topics. The index catalogs *actual* pages; there are none yet.
- Do not generate sample sources or pretend the user has uploaded anything.
- Do not research the subject. Bootstrap is structure-only.
- Do not create a `.obsidian/` config directory — Obsidian creates it on first open.

The reason: fabricated structure ages worse than no structure — it bakes in assumptions the user hasn't made yet. An empty `pages/` and a one-line `index.md` invite a clean start.

## Reporting back

After creating the structure, show:

1. The absolute path of the new vault.
2. A small directory tree.
3. One next-step hint: "Drop your first source into `sources/`, then ask me to ingest it." — a hint, not a forced workflow.
