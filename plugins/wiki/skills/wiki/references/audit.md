# Audit & Upgrade — Improving an Existing Second Brain

Full procedure for Mode 3: assessing an existing knowledge system and bringing it up to the LLM-wiki pattern. The target may be a vault bootstrapped by this skill, a hand-rolled Karpathy-style repo, or a plain Obsidian vault / notes folder that has never seen the pattern.

The flow is **inventory → scorecard → report → retrofit (approved steps only)**. Audit without approval changes nothing but the report.

## Safety rules (before anything else)

1. **Snapshot first.** If the folder is not under version control, propose `git init` + an initial commit before any modification. If it is, confirm the working tree is clean (or commit). Every retrofit step must be revertible.
2. **Never move, rename, or rewrite the user's original notes without explicit approval.** Existing notes are treated like `sources/` — read-only — until the user approves a specific change to a specific set of files.
3. **Map, don't force.** If the vault already has a working structure (PARA, Zettelkasten, daily notes, Johnny Decimal), map the pattern's roles onto it instead of restructuring. A PARA "Resources" folder can serve as `sources/`; a Zettelkasten's permanent notes are already `pages/`. The pattern needs its *roles* filled — raw layer, wiki layer, index, log, schema — not its exact folder names.
4. **Propose in batches, apply in steps.** Present the retrofit plan as ordered steps; apply one at a time so each is individually revertible and inspectable.

## Step 1 — Inventory

Explore the target folder (read-only) and establish:

- **Size and shape**: file count, folder tree, formats (md, PDF, canvas, images), naming conventions in use.
- **Existing conventions**: link style (`[[wikilinks]]` vs markdown links vs none), frontmatter usage and fields, tag usage, folder semantics.
- **Pattern pieces already present**: anything acting as an index, a changelog, a schema/CLAUDE.md, a raw-sources area, a wiki-pages area.
- **Tooling context**: is it an Obsidian vault (`.obsidian/` present)? Under git? Any plugins implied by the files (Dataview queries, canvas files, templater syntax)?
- **Content clusters**: the 3–5 dominant topics, roughly.

For large vaults, sample intelligently (biggest folders, most-linked notes, most recent notes) rather than reading everything.

## Step 2 — Scorecard

Score each dimension **present / partial / missing**, with one line of evidence:

| Dimension | What "present" looks like |
|-----------|---------------------------|
| **Source/wiki separation** | Raw inputs live apart from distilled notes; raw layer treated read-only |
| **Index** | A catalog file lists pages with one-line descriptions, updated as pages change |
| **Log** | Append-only changelog of changes, parseable entries |
| **Schema** | A written operating contract (SCHEMA.md / CLAUDE.md) an agent can follow |
| **Link discipline** | Consistent `[[wikilinks]]` between notes; few dangling links; graph is connected |
| **Page shape** | Consistent structure: summary up top, sources cited, frontmatter with type/tags/updated |
| **Source-backed claims** | Claims trace to sources; distilled notes cite what they distill |
| **Freshness** | No large body of contradicted/stale claims; recency visible (updated dates) |
| **Agent-readiness** | An LLM dropped into the vault could find the rules and operate without oral tradition |

Then run a **content-level mini-lint** on a sample (the checks from `references/operations.md`: contradictions, orphans, dangling links, index drift) to gauge health, not just structure.

## Step 3 — Report

Present to the user:

1. The scorecard with evidence.
2. The top 3–5 highest-leverage gaps, in plain language ("your notes cite nothing, so nothing can be verified or aged out" beats "source-backed claims: missing").
3. A proposed retrofit plan (Step 4 order, filtered to what's missing), with effort estimates and what each step touches.
4. Explicitly what will NOT be changed (original notes, existing structure that works).

Stop here until the user picks steps to apply.

## Step 4 — Retrofit sequence

Apply approved steps in this order — each makes the next one safer:

1. **Version control** — `git init` + commit if absent (from Safety rules; do first regardless of what else was approved).
2. **Schema** — write `meta/SCHEMA.md` (adapt `templates/SCHEMA.md.template`), but *describe the vault as it actually is*: its real folder names, its existing conventions where they work, plus the pattern's rules for everything going forward. The schema documents reality first, aspiration second.
3. **Log** — create `log.md` (adapt `templates/log.md.template`) with an `audit` entry as its first line. History before the log starts is not reconstructed.
4. **Index** — generate `index.md` from the actual pages: walk the vault, one line per note (link + description drawn from the note's opening), grouped by the vault's own categories. For huge vaults, index the wiki layer only, not raw sources.
5. **Source/wiki separation** — if raw material and distilled notes are mixed, propose the split: create `sources/`, move raw files there (approval per batch), leave distilled notes as `pages/` (or the vault's equivalent). Update links that break — verify with a dangling-link check afterward.
6. **Link repair** — fix dangling links, connect orphans, convert stray markdown-path links between pages to `[[wikilinks]]`.
7. **Page shape normalization** — the most invasive step; do last, and only on approval. Add frontmatter (type/tags/updated) and a summary paragraph to existing pages; claims' sources go in a body `## Sources` section per the schema's page shape. Do it in batches by folder, committing per batch. Never alter the substantive content while normalizing shape.
8. **Backfill sourcing** *(optional, slow)* — for key pages, trace claims to whatever sources exist and add Sources sections; mark the rest `(no source yet)` for future lints.

After each step: append a `log.md` entry (`## [YYYY-MM-DD] audit | step N: ...`) and commit.

## Upgrading a vault already on the pattern

For a vault that already follows the pattern (including ones bootstrapped by an older version of this skill), the audit is lighter — diff its `meta/SCHEMA.md` against the current `templates/SCHEMA.md.template` and propose adopting what's missing, typically:

- The parseable log-entry prefix (`## [YYYY-MM-DD] op | summary`).
- Page frontmatter (type/tags/updated).
- The write-back rule and contradiction-reconciliation convention.
- Synthesis pages as a recognized page type.

Propose these as schema amendments; never rewrite the user's schema wholesale — it may encode deliberate local decisions.

## Handing off

End every audit/upgrade with the vault in an operable state: schema current, log started, index true. The next session — human or agent — should be able to open `meta/SCHEMA.md` and run a normal ingest with no verbal handoff.
