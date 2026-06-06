# postgres

A PostgreSQL management coordinator for Claude Code. Inspect databases, run guarded SQL queries, and
copy/clone databases and tables — using the standard `psql`, `pg_dump`, and `createdb` CLI tools.

## Safety first

This plugin is **read and copy only**. It never performs destructive operations. Any request that
would `DROP`, `DELETE`, `TRUNCATE`, run an unscoped `UPDATE`, or overwrite an existing database is
**blocked** and requires an explicit **double confirmation** (state the impact, then type the exact
target name) before anything runs. The default answer to a destructive request is *no*.

## Prerequisites

- PostgreSQL client tools installed: `psql`, `pg_dump`, `createdb`
  - macOS: `brew install libpq` (then add to PATH), or `brew install postgresql`
  - Debian/Ubuntu: `apt-get install postgresql-client`
- Connection configured via the standard `libpq` environment variables, exported in your shell:

```bash
export PGHOST="your-host"
export PGUSER="your-user"
export PGPASSWORD="your-password"
# optional
export PGPORT="5432"
export PGDATABASE="your-default-db"
```

Verify:

```bash
psql --version
psql -d postgres -c '\conninfo'
```

## What it does

| Capability | Examples |
|------------|----------|
| **List & inspect** | "show my databases", "what tables are in app_db", "describe the users table", "how many rows in orders" |
| **Query** | "select the 20 newest users", "run this SQL", "how many orders last month" (destructive SQL is blocked) |
| **Copy / clone** | "clone app_db to app_db_backup", "copy the users table to users_archive", "snapshot this database to a file" |

## Usage

The skill activates automatically when you ask Postgres-related questions. Examples:

- *"List my databases with their sizes."*
- *"Describe the `orders` table and tell me how many rows it has."*
- *"Clone `production` into `production_copy`."*
- *"Run: `SELECT email FROM users WHERE active = true LIMIT 50;`"*

## Installation

Part of the `ghostmind-toolkits` marketplace. Enable the `postgres` plugin, or test locally:

```bash
cc --plugin-dir plugins/postgres
```
