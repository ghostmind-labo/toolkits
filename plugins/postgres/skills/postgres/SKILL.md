---
name: postgres
description: >-
  PostgreSQL management coordinator using the psql, pg_dump, and createdb CLI tools. Use this
  skill whenever the user wants to list databases or tables, inspect a schema, check table sizes
  or row counts, run a SQL query, look up data, or copy/clone a database or table to a new name.
  Also use when the user says things like "show me my databases", "what tables are in X",
  "describe this table", "run this query", "how many rows in", "select from", "copy this database",
  "clone the table", or any Postgres exploration, querying, or duplication task. Connects using the
  PGHOST, PGUSER, and PGPASSWORD environment variables. This skill is READ AND COPY ONLY — it never
  performs destructive operations (no DROP, DELETE, TRUNCATE, or unscoped UPDATE).
---

# Postgres — Database Management Coordinator

This skill coordinates the standard PostgreSQL CLI tools (`psql`, `pg_dump`, `createdb`) to help
with three things: **inspecting** databases, **querying** data, and **copying/cloning** databases
or tables. Each section below is a capability that can be used independently or chained together.

## ⚠️ SAFETY CONTRACT — read first, applies to everything

This skill is **read and copy only**. It exists to explore and duplicate data, never to destroy it.

**Never run, and never help construct, any of the following without the double-confirmation
protocol below:**

- `DROP` (database, table, schema, index, anything)
- `DELETE`
- `TRUNCATE`
- `UPDATE` without a `WHERE` clause, or any data-modifying statement whose blast radius is unclear
- `ALTER` that drops or rewrites columns/data
- `pg_restore`/`psql` that overwrites or replaces an existing database

**If a requested action would destroy or overwrite data, STOP and apply this protocol:**

1. **First confirmation.** State plainly what would be destroyed (which database/table, roughly how
   many rows if known) and that the action is irreversible. Ask the user to confirm they want to
   proceed. Do **not** run anything yet.
2. **Second confirmation.** If the user confirms, ask them to confirm a **second** time by typing
   the exact name of the target object (e.g. the database or table name). Only proceed if the typed
   name matches exactly.
3. If either confirmation is missing, ambiguous, or the typed name does not match — **do not run the
   command.** Report that the action was cancelled for safety.

The default answer to a destructive request is **no**. When in doubt, refuse and explain. Prefer
suggesting a non-destructive alternative (e.g. "copy to a new name instead of overwriting").

Inspecting and copying are always safe and need no confirmation.

## Setup

This skill uses the standard `libpq` environment variables to connect. No flags or hardcoded
credentials are needed — `psql`, `pg_dump`, and `createdb` all read these automatically:

| Variable | Purpose |
|----------|---------|
| `PGHOST` | Database host |
| `PGUSER` | Connecting role |
| `PGPASSWORD` | Password for that role |
| `PGPORT` | Port (optional, defaults to 5432) |
| `PGDATABASE` | Default database (optional) |

### Verify the tools and connection

Before doing real work, confirm the CLI tools exist and the connection works:

```bash
psql --version && pg_dump --version
psql -d postgres -c '\conninfo'
```

If `psql` is missing, the Postgres client tools are not installed — tell the user to install them
(`brew install libpq` on macOS, then add it to PATH, or `apt-get install postgresql-client` on
Debian/Ubuntu). If the connection fails, check that `PGHOST`/`PGUSER`/`PGPASSWORD` are exported in
the current shell (`echo "$PGHOST"`).

**Quoting note:** Pass SQL with `-c "..."`. For meta-commands (`\dt`, `\d`, `\l`) use `-c '\dt'`.
Add `-X` to skip the user's `.psqlrc`, and `-A -t` for clean, parseable output when feeding results
into further processing.

## Capability: List & inspect (always safe)

Use these read-only commands to explore. Pick `-d <database>` to target a specific database;
default to `postgres` for server-wide listings.

**List all databases** (with sizes):

```bash
psql -d postgres -c '\l+'
```

**List tables in a database:**

```bash
psql -d <database> -c '\dt'
```

**Describe a table** (columns, types, indexes, constraints):

```bash
psql -d <database> -c '\d+ <table>'
```

**Row count for a table:**

```bash
psql -d <database> -A -t -c 'SELECT count(*) FROM <table>;'
```

**Table sizes in a database** (largest first):

```bash
psql -d <database> -c "SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;"
```

**List schemas / roles / extensions:** `\dn`, `\du`, `\dx` respectively.

## Capability: Query (read-first, guarded)

The default is **read-only**. Run `SELECT` and other read queries freely:

```bash
psql -d <database> -c "SELECT id, name, created_at FROM users ORDER BY created_at DESC LIMIT 20;"
```

For large or exploratory result sets, use `-A -t` for clean output or `--csv` for spreadsheet-ready
data. Wrap untrusted/expensive queries with `EXPLAIN` first to understand cost.

**Before running ANY query the user provides, scan the SQL for destructive statements.** If it
contains `DROP`, `DELETE`, `TRUNCATE`, `UPDATE`/`INSERT` without a clear scope, `ALTER ... DROP`, or
similar — do **not** run it. Apply the double-confirmation protocol from the Safety Contract above,
and prefer steering the user toward a non-destructive approach. Read queries (`SELECT`, `EXPLAIN`,
`SHOW`, `\d` meta-commands) need no confirmation.

To make read-only intent enforceable at the database level, prefix a session with a read-only
transaction when running user-supplied SQL:

```bash
psql -d <database> -v ON_ERROR_STOP=1 -c 'SET default_transaction_read_only = on;' -c "<their SELECT here>"
```

This causes the server itself to reject any write, as a backstop to the manual scan.

## Capability: Copy / clone (safe — creates new objects only)

Copying never overwrites: it always produces a **new** database or table. If the target name already
exists, stop and report it rather than overwriting (overwriting is destructive — see Safety Contract).

**Clone an entire database to a new name.** First check the target does not already exist:

```bash
psql -d postgres -A -t -c "SELECT 1 FROM pg_database WHERE datname = '<new_db>';"
```

If that returns nothing, clone with template (fast, server-side — requires no active connections to
the source):

```bash
createdb -T <source_db> <new_db>
```

If `createdb -T` fails because the source has active connections, fall back to dump-and-load into a
freshly created database:

```bash
createdb <new_db>
pg_dump <source_db> | psql -d <new_db> -v ON_ERROR_STOP=1
```

**Copy a single table to a new table in the same database** (structure + data):

```bash
psql -d <database> -c 'CREATE TABLE <new_table> (LIKE <source_table> INCLUDING ALL);'
psql -d <database> -c 'INSERT INTO <new_table> SELECT * FROM <source_table>;'
```

**Copy a table to a new database** (dump just that table, load into target):

```bash
pg_dump -t <source_table> <source_db> | psql -d <target_db> -v ON_ERROR_STOP=1
```

**Snapshot a database to a file** (backup before any risky work, or to move between hosts):

```bash
pg_dump -Fc <source_db> -f <source_db>_$(date +%Y%m%d).dump
```

After any copy, verify by listing the new object and comparing a row count against the source.

## Workflow guidance

- **Always confirm the target before acting.** List databases/tables first so the user sees exactly
  what exists, then operate on a confirmed name.
- **Chain naturally:** inspect → query to validate → copy. E.g. describe a table, count its rows,
  then clone it and confirm the clone has the same count.
- **Report what ran.** After each command, summarize what happened and show the relevant output, so
  the user always knows the current state.
- **Never improvise destruction.** If the user's goal seems to need a delete (e.g. "replace this
  database"), propose a copy-to-new-name path instead, and only consider destruction under the
  double-confirmation protocol.
