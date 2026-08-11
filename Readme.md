# ghostmind toolkits

Misc skills, commands, and hooks for [Claude Code](https://code.claude.com/docs/en/overview),
shipped as a single plugin.

## Installation

```bash
claude plugin marketplace add ghostmind-labo/toolkits
claude plugin install toolkits@ghostmind-toolkits
```

Or from inside a session: `/plugin marketplace add ghostmind-labo/toolkits`, then
`/plugin install toolkits@ghostmind-toolkits`.

## What's inside

| | Name | What it does |
|---|---|---|
| skill | [`wiki`](./skills/wiki) | Build and maintain a personal LLM-maintained wiki (second brain) as an Obsidian vault |
| skill | [`places`](./skills/places) | City exploration via Google Maps — find places, directions, transit, geocoding |
| skill | [`postgres`](./skills/postgres) | Inspect, query, and clone Postgres databases — read and copy only |
| command | [`/toolkits:ship`](./commands/ship.md) | Stage → commit → push → PR into `main` → auto-merge, in one command |
| hook | [`session chime`](./hooks/hooks.json) | Plays a gentle chime whenever Claude is waiting for your input |

Skills activate on their own when you ask a matching question — no invocation needed.

---

## Skills

### wiki

Constructs, operates, and audits a personal wiki following Karpathy's LLM-wiki pattern:
raw **sources** compile into an interlinked **wiki**, governed by a **schema**. Handles
the full lifecycle — bootstrap a new vault, ingest sources, query it, lint it, or
retrofit the pattern onto notes you already have.

> *"Start a wiki on X"* · *"Ingest this article into my wiki"* · *"Audit my second brain"*

### places

Coordinates several Google Maps APIs together — find nearby places, get directions by
transit/walking/driving/cycling, compare travel times, geocode addresses, look up time
zones. Chains multiple steps in one request.

**Requires** a Google Cloud project with a Maps API key; one key covers every API used.
Setup walkthrough is in [the skill](./skills/places/SKILL.md).

> *"What's nearby"* · *"How do I get there by metro"* · *"How far is X from Y"*

### postgres

Wraps the standard `psql`, `pg_dump`, and `createdb` CLI tools for inspecting databases,
running queries, and cloning databases or tables.

**This skill is read and copy only.** Any request that would `DROP`, `DELETE`, `TRUNCATE`,
run an unscoped `UPDATE`, or overwrite an existing database is blocked, and requires an
explicit double confirmation — state the impact, then type the exact target name — before
anything runs. The default answer to a destructive request is *no*.

**Prerequisites:**

- Client tools on PATH: `psql`, `pg_dump`, `createdb`
  - macOS: `brew install libpq` (then add to PATH), or `brew install postgresql`
  - Debian/Ubuntu: `apt-get install postgresql-client`
- Connection via the standard `libpq` environment variables:

```bash
export PGHOST="your-host"
export PGUSER="your-user"
export PGPASSWORD="your-password"
# optional
export PGPORT="5432"
export PGDATABASE="your-default-db"
```

Verify with `psql -d postgres -c '\conninfo'`.

> *"List my databases with their sizes"* · *"Describe the orders table"* · *"Clone production into production_copy"*

---

## Command

### `/toolkits:ship`

Takes all work on the current branch from working tree to `main` in one shot: stage →
auto-write a commit message from the diff → push → open a PR into `main` → auto-merge.
Local `main` is never committed to directly; everything flows through a pull request, and
the command refuses to run while `main` is checked out.

Accepts an optional commit message: `/toolkits:ship fix the parser`.

Requires an authenticated [`gh`](https://cli.github.com) CLI.

---

## Hook

### Session chime

Plays a gentle, joyful chime whenever Claude is waiting for you — needing permission to
run something, or otherwise handing the turn back. Step away from the terminal and let the
sound bring you back the moment your attention is needed. Wired to the `Notification` hook
event.

The sound is a short (~0.9s) ascending C-major arpeggio with a soft, bell-like decay,
bundled as `assets/input-needed.wav` (44.1 kHz, 16-bit mono) — intentionally quiet and
unobtrusive.

**Playback** picks the first available player and degrades gracefully:

| Platform | Player |
|---|---|
| macOS | `afplay` |
| Linux (PulseAudio/PipeWire) | `paplay` |
| Linux (ALSA) | `aplay` |
| Any with ffmpeg | `ffplay` |
| Windows (WSL/Git Bash) | `powershell.exe` SoundPlayer |
| None of the above | terminal bell (`\a`) |

It plays in the background and exits immediately, so it never delays your prompt.

**Mute it** without uninstalling:

```bash
export SESSION_SOUND_DISABLED=1
```

**Regenerate the sound** — the asset is reproducible, no audio editor needed:

```bash
python3 scripts/generate-chime.py
```

Tweak the constants at the top of the script: `AMPLITUDE` (volume, default `0.13`),
`NOTES` (arpeggio pitches), `DECAY` (fade speed), `NOTE_DURATION` / `NOTE_SPACING`.

> **Note:** hooks load at session start. After installing the plugin or editing the hook,
> restart Claude Code for the chime to take effect.

---

## Local development

Test the whole plugin from a checkout without installing it:

```bash
claude --plugin-dir ./
```

Layout:

```
.claude-plugin/
  plugin.json        # the single plugin manifest; skills[] lists each skill folder
  marketplace.json   # one entry, source "./"
skills/<name>/SKILL.md
commands/            # slash commands
hooks/               # hooks.json + scripts
assets/              # bundled binary assets
scripts/             # maintenance scripts
```

Adding a skill means creating `skills/<name>/SKILL.md` and appending its path to `skills[]`
in `plugin.json`.
