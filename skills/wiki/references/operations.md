# Operations — Ingest, Query, Lint, Synthesis

Full procedures for Mode 2, operating inside an existing wiki.

**Authority order:** the vault's own `meta/SCHEMA.md` (or a `CLAUDE.md` acting as schema) overrides anything here. Read it before the first operation of a session. This file is the default behavior when the vault's schema is silent on a point.

## Log entry format (all operations)

Every operation that changes the wiki appends one entry to `log.md`, newest at the bottom, with a consistent, unix-parseable prefix (read-only queries are the one exception — see Query):

```markdown
## [2026-07-03] ingest | The Fall of the Tokugawa Shogunate (article)

- created: [[meiji-restoration]], [[satsuma-domain]]
- updated: [[tokugawa-shogunate]], [[edo-period-economy]], [[index]]
- notes: supersedes population estimate on [[edo-period-economy]] (older source kept as footnote)
```

Operation names: `ingest`, `query`, `lint`, `synthesis`, `edit`, `bootstrap`, `audit`. The prefix `## [YYYY-MM-DD] op | summary` makes the log greppable (`grep '^## \[' log.md`). Never rewrite existing entries.

## Ingest

Trigger: a new file appears in `sources/`, or the user hands over a URL, PDF, transcript, or pasted text.

1. **Land the source.** If given a URL or pasted content, save it into `sources/` first (a markdown copy for web articles, the file itself for PDFs). Sources are immutable from then on — read-only.
2. **Read it fully** and extract key claims, entities (people, places, organizations), concepts, dates, and numbers.
3. **Discuss before filing when the source is substantial** — for a book chapter or dense paper, surface the key takeaways to the user first; their reactions shape what gets emphasized. For routine articles, file directly.
4. **Touch every page the source affects** — typically 5–15 per real source:
   - **Existing page covers it → edit that page in place.** This is the write-back rule: update the entity's own page, do not create a parallel note that only a backlink connects. Integrate the new claim where it belongs; if it supersedes an old claim, replace the old claim and note the supersession (see Contradictions below).
   - **No page, and the topic warrants one → create it** following the page shape in the schema (frontmatter, summary paragraph, sections, Sources, See also).
   - **No page, topic marginal → mention it inline** on a related page with a `[[wikilink]]`. Obsidian shows it as an unresolved link — a cheap signal of what might deserve a page later.
5. **Cite as you write.** Every claim traces to a source: list the source file in the page's Sources section, with a short note or quote of what was used. This is what makes lint verification and staleness detection possible.
6. **Update `index.md`** with any new pages (one line each: link + one-line description, under a category).
7. **Append the `log.md` entry** listing created/updated pages.

Calibration: fewer than 2 page touches suggests the source is marginal to the subject — say so rather than force-filing it. More than ~15 suggests the wiki is underdeveloped in that area, which is fine early on.

## Query

Trigger: the user asks a question about the subject.

1. **Search `pages/`** — filenames, headings, frontmatter tags, body text (`grep`/Glob are sufficient; `index.md` is the map). Follow `[[wikilinks]]` outward from the best hits.
2. **Synthesize the answer from wiki pages**, citing which pages were used. If a page carries a claim needing verification, check it against the source it cites rather than trusting the page blindly.
3. **If the wiki cannot answer**, say so — do not silently fall back to general knowledge. Offer to answer from general knowledge with clear labeling, and note the gap as an ingestion candidate.
4. **File good answers back.** If the answer required synthesis not yet written anywhere, offer to save it as a new page or a page edit. This is how querying compounds the wiki instead of just consuming it. Read-only queries are not logged; log a `query` entry only when something is filed back, noting the filed page.

## Lint

Trigger: the user asks for a health check, or periodically after several ingests. Lint is read-analyze-propose: report findings, propose fixes, **apply only what the user approves**, then log.

Checks, in order of value:

1. **Contradictions** — pages making opposing claims about the same fact. For each, propose a reconciliation (see below).
2. **Stale claims** — assertions contradicted or outdated by newer sources in `sources/`. Flag with the newer source cited.
3. **Dangling links** — `[[wikilinks]]` pointing at non-existent pages. Either a page worth creating (bundle candidates into a suggestion) or a typo (propose the fix). Obsidian's unresolved-links pane shows these live; replicate with grep across `pages/`.
4. **Orphans** — pages with no incoming links. Propose where existing pages should link to them.
5. **Missing cross-references** — pages that clearly relate but do not link. Propose the links.
6. **Index drift** — pages missing from `index.md`, or index entries whose pages are gone.
7. **Compression trap** — clusters of pages that have grown larger than the sources they summarize, or fragmented micro-pages. Propose collapsing into a dense single page or a comparison table.
8. **Unsourced claims** — text marked `(no source yet)` or claims with no Sources entry. List for the user to source or strike.

### Contradiction reconciliation

Default rule: **newer source wins**. When two pages (or two claims on one page) conflict:

- Update the affected page(s) to the newer claim.
- Keep the superseded claim as a one-line footnote: `Previously reported as X ([[old-source]], superseded 2026-07-03).` — this preserves the history without leaving live contradictions.
- If recency does not settle it (equal-vintage sources, or a primary source contradicted by a newer secondary one), present both to the user and let them decide; record the decision on the page.

Never delete the losing claim silently, and never leave both claims standing unmarked.

## Synthesis (unsolicited insight)

The wiki should occasionally produce insight nobody asked for. After an ingest or lint, when a pattern is noticeable across pages — a recurring unnamed theme, a tension between positions, a cluster begging for a comparison table — offer a **synthesis page**: a page whose sources are other wiki pages rather than raw sources.

- Frontmatter `type: synthesis`; Sources section lists the wiki pages it draws on.
- Propose it, don't just write it — one line: "Three pages now touch X from different angles; want a synthesis page?"
- Log as `synthesis`.

Keep this rare and high-signal. A synthesis page that restates the index is noise.

## Session hygiene

- Start each operating session by reading `meta/SCHEMA.md` and skimming the tail of `log.md` for recent context.
- If a convention in the schema repeatedly fights the actual work, propose a schema amendment (edit `meta/SCHEMA.md` with approval, log as `edit`) instead of quietly deviating.
- Batch related operations into one log entry per user request, not one per file touched.
