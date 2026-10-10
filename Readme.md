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
| skill | [`generate-image`](./skills/generate-image) | Generate and edit images, routing each job to the best model across Google and OpenAI |
| skill | [`youtube-summary`](./skills/youtube-summary) | Summarize or question a YouTube video from its URL via Gemini's agentic video understanding |
| skill | [`file-exchange`](./skills/file-exchange) | Export a file to a GCS bucket and get a URL — private to hand screenshots and files between agents and projects, or public for a link anyone can open |
| skill | [`agent-channel-read`](./skills/agent-channel-read) | Read, claim and watch messages that other Claude sessions left on the Potion `agent-channel` |
| skill | [`agent-channel-write`](./skills/agent-channel-write) | Send a self-contained message to a Claude session in another project through the Potion `agent-channel` |
| skill | [`understand`](./skills/understand) | Explain something in the format that is easiest to take in: Simplified Technical English, a diagram, an HTML page, or a narrated explainer video |
| command | [`/toolkits:ship`](./commands/ship.md) | Stage → commit → push → PR into `main` → auto-merge, in one command |
| command | [`/toolkits:bump`](./commands/bump.md) | Ask for the bump level, write the plugin's new version, then ship |
| hook | [`session chime`](./hooks/hooks.json) | Plays a gentle chime whenever Claude is waiting for your input |
| hook | [`spoken summary`](./hooks/speak.sh) | Reads the summary of a reply aloud, only when asked: "out loud" in a prompt, or "voice on" |
| mod | [`session-name`](./mods/session-name) | Always shows this session's name above the prompt: the name other Claude sessions message it by. |
| mod | [`session-badge`](./mods/session-badge) | A colourful always-on badge above the prompt: this session's name, whether it is working, turns, tool calls, messages from other sessions, uptime and a sparkline of recent turns. |
| mod | [`session-beacon`](./mods/session-beacon) | A band above the prompt showing this session's peer name and whether it is receiving from or sending to another session. |
| mod | [`session-inbox`](./mods/session-inbox) | A pane that shows this session's name (the address other sessions message it at) and the messages that arrive from other sessions. |

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

### generate-image

Routes every image request to the model that is actually best at that job, instead of sending
everything to one generator. Cartoons, illustrations, and icons go to **Nano Banana 2**
(`gemini-3.1-flash-image`); photoreal and product shots to **Nano Banana Pro**; anything with
readable words — posters, thumbnails with titles, diagrams, UI mockups — to **GPT Image 2.5
Flare**; rough drafts to the Lite model. `--compare a,b` runs one prompt through several models
in parallel so you can pick. OpenAI failures (no key, no credits) fall back to Google
automatically.

Generation is only half of it. A bundled Python tool (`scripts/edit.py`) handles what comes
after, locally and for free: cut an image into a grid, adjust contrast/brightness/saturation,
crop to a ratio (centre or content-aware), trim borders, letterbox, resize, convert formats,
build an icon set, trace a logo to **SVG**, pull the **colour palette** as hex, tile images into
a labelled comparison sheet, export a **PDF**, or remove the background. It runs through
`uv run --script`, which installs its own dependencies into a cached environment — no global
installs, nothing to set up.

**Prerequisites:** [`deno`](https://deno.com), [`uv`](https://docs.astral.sh/uv/) for the editing
tool, plus at least one key, read from the environment or `~/.env`:

```bash
export GEMINI_API_KEY="your-key"   # Google models
export OPENAI_API_KEY="your-key"   # OpenAI models (account needs credits)
```

> *"Generate a cartoon fox"* · *"Make a YouTube thumbnail that says LAUNCH DAY"* · *"Compare both models on this prompt"* · *"Edit this image and remove the background"*

### youtube-summary

Sends a YouTube URL straight to the Gemini API with **agentic video understanding**: the
model navigates the video's frames, audio, and transcript itself, so slides, code, and demos
shown on screen make it into the summary — not just what was said. Falls back to static
frame sampling when a model lacks agentic support. Modes: full summary (default), TL;DR,
timestamped chapters, study notes, or a free-form question; can clip a time range, answer in
another language, and save to a file.

**Prerequisites:** [`deno`](https://deno.com) on PATH and a Gemini API key from
[AI Studio](https://aistudio.google.com/apikey):

```bash
export GEMINI_API_KEY="your-api-key"
```

Public videos only. The free tier caps YouTube input at 8 hours of video per day.

> *"Summarize this video"* · *"TL;DR this talk"* · *"Give me the chapters with timestamps"* · *"What did they say about pricing at 12:00?"*

### file-exchange

Moves images and other files between machines, projects and agents through a **private**
Google Cloud Storage bucket, or publishes them to a **public** one with `--public`. `export` uploads a local screenshot and prints its
`https://storage.googleapis.com/...` URL — a handle to store in a record or pass to another
agent. `import` turns that URL (or any `gs://` path) back into a local file, reading through
gcloud, so it works on any machine logged into an account with access and nothing is exposed
anonymously. No service account, no API key; the bucket is created on first use.

`export --public` uploads to a second, public bucket instead and prints a URL anyone can
open without a login. That bucket is also created on first use (readable by URL, not
listable); an existing bucket is never reconfigured, the script only checks that the URL
really answers anonymously before printing it.

Built for one workflow: spot a visual bug while working on a project, screenshot it, export
it, and file a Potion record (`bug` structure: date, type, description, image_url) pointing
at the URL. Later, from the project that owns the bug, list the open records, import the
screenshot, and look at it while fixing.

**Prerequisites:** [`gcloud`](https://cloud.google.com/sdk) logged in (`gcloud auth login`).
Project and bucket resolve from flags, the environment, or `~/.env`:

```bash
export GCP_PROJECT_ID="your-project"          # else gcloud's core/project
export GCS_IMAGE_BUCKET="your-bucket"         # private, else <project>-images
export GCS_PUBLIC_BUCKET="your-public-bucket" # used by --public, else <project>-public
export GCS_IMAGE_LOCATION="us-central1"       # only used when creating the bucket
```

> *"Upload this screenshot and give me the URL"* · *"File this as a bug with the image"* · *"Get the screenshot from that bug record"* · *"Give me a public link for this PDF"*

### agent-channel-read / agent-channel-write

A message bus between Claude sessions running in different projects and terminals. The
channel is the `agent-channel` structure in a Potion workspace; each row is one message
(`kind`, `status`, `to_project`, `from_session`, `thread`, `body`, `result`…).
`agent-channel-write` writes a self-contained message addressed to a project (and
optionally a specific session). `agent-channel-read` picks up the newest message, asks
before claiming a directive, and writes the result back onto the same row. Pass `watch`
and it holds Potion's live record watch open through `scripts/watch.sh`, raising an event
when a message arrives for this project or when one it sent gets answered.

**Prerequisites:** a connected Potion MCP whose workspace has an `agent-channel`
structure. For `watch`, also `curl`, `jq` and `POTION_API_KEY` (in the environment or
`~/.env`).

> *"Tell the ensemble session the tests pass"* · *"Check the agent channel"* · *"Watch the channel for replies"*

### understand

Spends effort on the reading side of working with a model. It follows a ladder from a note by
Andrej Karpathy, where each rung costs more to make and less to read: prose in **ASD-STE100**
(Simplified Technical English, the controlled language of aircraft maintenance manuals,
applied "80% of the way" by default), a **diagram**, a self-contained interactive **HTML
page**, or a narrated **explainer video** in the style of 3Blue1Brown. The skill takes the
lowest rung that carries the subject, or the one you name.

The video rung is a small pipeline: `narrate.sh` makes the voice for each beat of the script
and measures it, a Manim scene holds each beat for as long as its narration, and `mux.sh` lays
the voice on the render. `manim.sh` runs Manim Community through `uv`, with nothing installed
globally.

**Prerequisites** (video only): [`uv`](https://docs.astral.sh/uv/), `ffmpeg`, `jq`, and the
cairo library (`brew install cairo`). The voice is ElevenLabs through
OpenRouter when `OPENROUTER_API_KEY` is set, and the free macOS `say` voice otherwise.

> *"Explain this diff in STE"* · *"Draw me a diagram of the auth flow"* · *"Explain this as a web page"* · *"Make a 3b1b style video on binary search"*

---

## Commands

### `/toolkits:ship`

Takes all work on the current branch from working tree to `main` in one shot: stage →
auto-write a commit message from the diff → push → open a PR into `main` → auto-merge.
Local `main` is never committed to directly; everything flows through a pull request, and
the command refuses to run while `main` is checked out.

Accepts an optional commit message: `/toolkits:ship fix the parser`.

Requires an authenticated [`gh`](https://cli.github.com) CLI.

### `/toolkits:bump`

Versions a Claude Code plugin and ships it. An installed plugin only updates when its
`version` changes, so this is the command for a change that has to reach people. It finds the
plugin that changed (a marketplace repository can hold several), reads the diff, and asks
once: patch, minor or major, with the level it recommends first. Then it writes the version
in `plugin.json`, and wherever else the repository records it, and hands over to
`/toolkits:ship` with a commit message that ends with the new version.

It does not bump twice: when the version on the branch is already ahead of `main`, it keeps
it. Like ship, it refuses to run on `main`.

Accepts the answer up front: `/toolkits:bump minor`, `/toolkits:bump 1.0.0 session-name`.

---

## Mods

A mod changes Claude Code's own interface: a band above the prompt, a pane, a badge. Each one
is a small plugin of its own under `mods/`, listed in this marketplace next to `toolkits`, so
it is installed by name:

```bash
claude plugin install session-name@ghostmind-toolkits
```

| Mod | What it adds |
|---|---|
| `session-name` | Always shows this session's name above the prompt: the name other Claude sessions message it by. |
| `session-badge` | A colourful always-on badge above the prompt: this session's name, whether it is working, turns, tool calls, messages from other sessions, uptime and a sparkline of recent turns. |
| `session-beacon` | A band above the prompt showing this session's peer name and whether it is receiving from or sending to another session. |
| `session-inbox` | A pane that shows this session's name (the address other sessions message it at) and the messages that arrive from other sessions. |

`session-name` is the one in daily use; the other three are earlier takes on the same idea,
kept so they are not lost. To work on one, copy its folder to `~/.claude/mods/` and Claude Code
reloads it as you edit.

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

### Spoken summary

Reads the summary of a reply aloud, in a natural voice, and only when asked. It stays silent
otherwise.

| You send | What happens |
|---|---|
| a prompt containing `out loud` or `read it back` | that one reply is spoken |
| `voice on` | every reply is spoken until `voice off` |
| `voice off` | stops, and cuts off anything still playing |
| `voice <name>` | changes the voice; it introduces itself |
| `voice` | shows whether it is on, the current voice and the list |

**What is spoken** is the opening paragraph of the reply, where the summary sits, with the
markdown removed. Headings, tables, lists and code are skipped.

**The voice** is ElevenLabs (`elevenlabs/eleven-v4`) through
[OpenRouter's speech endpoint](https://openrouter.ai/docs/guides/overview/multimodal/tts).
It needs `OPENROUTER_API_KEY` in the environment Claude Code starts from. A summary costs
well under a cent. Set `SPEAK_MODEL` or `SPEAK_VOICE` to try another model or voice.

The request and the playback run in the background, so the terminal is never held; the audio
starts about three seconds after the reply ends. macOS only for now (`afplay`). Its state
(the chosen voice, the last clip, a log) lives in `~/.claude/speak/`.

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
mods/                # one folder per mod, each a plugin of its own
assets/              # bundled binary assets
scripts/             # maintenance scripts
```

Adding a skill means creating `skills/<name>/SKILL.md` and appending its path to `skills[]`
in `plugin.json`.
