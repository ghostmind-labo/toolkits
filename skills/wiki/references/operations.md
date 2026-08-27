# Operations — Ingest, Query, Lint, Synthesis

Full procedures for Mode 2, operating inside an existing wiki workspace over the Potion MCP.

**Authority order:** the workspace's own Schema note (title `Schema`) overrides anything here. Read it before the first operation of a session, and skim the tail of the Log note (title `Log`) for recent context. This file is the default behavior when the Schema note is silent on a point.

## Log entry format (all operations)

Every operation that changes the wiki appends one entry to the Log note, newest at the bottom. There is no append API: `read_note` the Log, add the entry at the end, `update_note` with the full body. Never drop or rewrite existing entries.

```markdown
## [2026-08-26] ingest | The Fall of the Tokugawa Shogunate (article)

- created: [[Meiji Restoration]], [[Satsuma Domain]]
- updated: [[Tokugawa Shogunate]], [[Edo Period Economy]], [[Index]]
- notes: supersedes population estimate on [[Edo Period Economy]] (older source kept as footnote)
```

Operation names: `ingest`, `query`, `lint`, `sync`, `synthesis`, `edit`, `bootstrap`. The prefix `## [YYYY-MM-DD] op | summary` keeps the log scannable and searchable. Read-only queries are the one exception — see Query.

## Ingest

Trigger: the user hands over a URL, PDF, transcript, or pasted text, points at a file already attached to the Sources note, or asks to ingest a note they captured earlier (e.g. clipped with the Chrome extension and tagged `source`).

1. **Land the source on the Sources note**:
   - A file or a URL to one (PDF, EPUB, DOCX, CSV…) → `fetch_file` (preferred for anything on the web — nothing passes through you) or `upload_file`, with `note_id` = the Sources note.
   - A web article or pasted text → either save it as markdown attached to the Sources note, or — if it's substantial enough to deserve its own note — `create_note` tagged `source` with the content, and reference it from the ledger.
   - **Add a ledger row** to the Sources table: name (`[[file:name.pdf]]` for attachments — file refs resolve here because the file is attached to this note — or a `[[wikilink]]` for source notes), type, today's date, one-line description, status `pending`.
   - Sources are immutable from then on — read-only.
2. **Read it.** `describe_file` first (status, outline, first lines), then `read_file` by pages/sections and `search_file` for targeted lookups. Never pull a large document whole. Extract key claims, entities (people, places, organizations), concepts, dates, numbers.
3. **Discuss before filing when the source is substantial** — for a book chapter or dense paper, surface the key takeaways to the user first; their reactions shape what gets emphasized. For routine articles, file directly.
4. **Touch every page the source affects** — typically 5–15 per real source:
   - **Existing page covers it → `update_note` that page in place.** This is the write-back rule: update the entity's own page, do not create a parallel note that only a backlink connects. If a new claim supersedes an old one, replace it and note the supersession (see Contradictions).
   - **No page, and the topic warrants one → `create_note`** following the Schema note's page shape, with tags `["page", "<type>"]` (`concept` | `entity` | `source-summary` | `synthesis`).
   - **No page, topic marginal → mention it inline** on a related page with a `[[wikilink]]`. It stays dim/unresolved — a cheap signal of what might deserve a page later, and `lint_links` will surface it.
   - **Cite as you write:** every claim traces to a source. Pages cite by name + a link to `[[Sources]]` (or the source's own note) — **never `[[file:...]]` refs, which only resolve on the note the file is attached to.** Example Sources section line: `- report.pdf, p. 12 (see [[Sources]]) — the productivity figures`.
   - Link pages to each other with `[[Title|uuid]]` when the id is known (every create/search returns it) — a title alone can mis-resolve if duplicated.
5. **Update the Index** with any new pages (one line each: link + one-line description, under a category — categories emerge, they are not invented ahead of pages). If the source answers an entry under **Open questions**, resolve it: remove the question and note the resolution in the log entry.
6. **Append the Log entry** listing created/updated pages.
7. **Flip the ledger row** on the Sources note from `pending` to `ingested`.

Calibration: fewer than 2 page touches suggests the source is marginal to the subject — say so rather than force-filing it. More than ~15 suggests the wiki is underdeveloped in that area, which is fine early on.

## Query

Trigger: the user asks a question about the subject.

1. **Search the wiki** — `search_notes` for full-text, `search_notes_by_tags(["page"])` to scan pages (AND logic; `list_notes` caps at 30, so search, don't list). The Index is the map; follow `[[wikilinks]]` outward from the best hits with `list_note_links`.
2. **Synthesize the answer from wiki pages**, citing which notes were used. If a page carries a claim needing verification, check it against the source it cites (`search_file` into the attachment) rather than trusting the page blindly.
3. **If the wiki cannot answer**, say so — do not silently fall back to general knowledge. Offer to answer from general knowledge with clear labeling, and file the gap under **Open questions** on the Index so it becomes an ingestion target.
4. **File good answers back.** If the answer required synthesis not yet written anywhere, offer to save it as a page (tags `["page", "synthesis"]`) or a page edit. This is how querying compounds the wiki instead of just consuming it. Read-only queries are not logged; log a `query` entry only when something is filed back.

## Lint

Trigger: the user asks for a health check, or periodically after several ingests. Lint is read-analyze-propose: report findings, propose fixes, **apply only what the user approves**, then log.

Checks, in order of value:

1. **Contradictions** — pages making opposing claims about the same fact. For each, propose a reconciliation (see below).
2. **Stale claims** — assertions contradicted or outdated by newer sources in the ledger. Flag with the newer source cited.
3. **Dangling links & orphans** — `lint_links` reports both natively: `dangling` (link texts pointing at no note, grouped by referencing note) and `orphans` (notes nothing links to). Dangling links are either create-worthy pages (bundle candidates into a suggestion) or typos (propose the fix). For orphans, propose where existing pages should link to them.
4. **Missing cross-references** — pages that clearly relate but do not link. Propose the links (with uuids).
5. **Index drift** — pages missing from the Index, or Index entries whose pages are gone. Also ledger drift: attachments on the Sources note without a table row, or rows stuck `pending`.
6. **Compression trap** — clusters of pages that have grown larger than the sources they summarize, or fragmented micro-pages. Propose collapsing into a dense single page or a comparison table.
7. **Unsourced claims** — text marked `(no source yet)` or claims with no Sources section entry. List for the user to source or strike.
8. **Single-source claims** — load-bearing claims (ones other pages build on) resting on a single source. Not an error — propose a corroborating source as an Open questions entry.
9. **Open-question drift** — entries under **Open questions** already answered by later ingests, or stale enough to drop.

Lint is also where new questions come from: after the checks, suggest 2–3 questions or sources that would most strengthen the wiki, and add the ones the user endorses to **Open questions**. For a learning wiki this is the growth engine — the wiki tells the user what to read next.

### Contradiction reconciliation

Default rule: **newer source wins**. When two pages (or two claims on one page) conflict:

- Update the affected page(s) to the newer claim.
- Keep the superseded claim as a one-line footnote: `Previously reported as X (older source, see [[Sources]]; superseded 2026-08-26).` — this preserves the history without leaving live contradictions.
- If recency does not settle it (equal-vintage sources, or a primary source contradicted by a newer secondary one), present both to the user and let them decide; record the decision on the page.

Never delete the losing claim silently, and never leave both claims standing unmarked.

## Sync

Trigger: the user runs `/toolkits:wiki-sync`, mentions sources that were captured outside a session (Chrome-extension clips, files attached in the UI), or a lint reveals ledger drift worth its own pass.

Sources arrive out-of-band: the user clips an article to a note and tags it `source`, or attaches a file directly in the app. **The `source` tag is the capture convention** — anything tagged `source` is a source, wherever it came from — **and the ledger on the Sources note is the catalog**. Sync makes them agree:

1. **Collect reality:** `list_files()` for every attachment workspace-wide; `search_notes_by_tags(["source"])` for every source note; `list_notes` newest-first for recent notes that *look* like clipped sources but were never tagged (candidates only — never auto-classify).
2. **Diff against the ledger:** missing rows (attachments or `source`-tagged notes with no row), orphan rows (pointing at nothing), stuck rows (still `pending`), untagged candidates.
3. **Report, then apply what the user approves:** add missing rows (status `pending`; `[[file:...]]` refs only for files attached to the Sources note itself — files attached elsewhere and source notes get `[[Title|uuid]]` links); tag approved candidates `source` (preserve their existing tags — `update_note` replaces the whole set); propose orphan-row removal, never silent. Stuck `pending` rows are ingest candidates — offer, don't start.
4. **Log a `sync` entry** (rows added, flagged, tagged). A clean sync is reported but not logged.

Sync touches the ledger, tags, and Log — never the content of a source.

## Synthesis (unsolicited insight)

The wiki should occasionally produce insight nobody asked for. After an ingest or lint, when a pattern is noticeable across pages — a recurring unnamed theme, a tension between positions, a cluster begging for a comparison table — offer a **synthesis page**: a page whose sources are other wiki pages rather than raw sources.

- Tags `["page", "synthesis"]`; its Sources section lists the wiki pages it draws on (with uuids).
- Propose it, don't just write it — one line: "Three pages now touch X from different angles; want a synthesis page?"
- Log as `synthesis`.

Keep this rare and high-signal. A synthesis page that restates the Index is noise.

## Session hygiene

- Start each operating session by reading the Schema note (`find_note("Schema")`) and skimming the tail of the Log.
- If a convention in the Schema repeatedly fights the actual work, propose an amendment (`update_note` the Schema with approval, log as `edit`) instead of quietly deviating. Upgrading an older wiki works the same way: diff its Schema note against the current `templates/schema-note.md.template` and propose adopting what's missing — never rewrite it wholesale.
- Batch related operations into one log entry per user request, not one per note touched.
- Rich rendering is available when it helps: Mermaid blocks for relationship diagrams, `$...$` math, tables. Keep pages markdown-first; save HTML blocks for genuinely visual answers.
