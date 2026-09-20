---
name: image-exchange
description: >-
  Export a local image (screenshot, render, diagram) to a private Google Cloud Storage bucket
  and get back a URL, or import an image from such a URL to a local file — so one agent,
  project or machine can hand a picture to another through the gcloud login they share. Use
  this skill whenever the user says "upload this screenshot", "give me a URL for this image",
  "export this image", "share this image with the other agent", "make this image available",
  "import this image", "fetch the screenshot from the bug", "get the image from that record",
  or when a workflow needs an image URL — for example filing a bug with a screenshot as a
  Potion record, and later pulling that screenshot back to look at while fixing it. Works with
  whatever account gcloud is logged into.
---

# Image exchange — images in and out of a GCS bucket

One bash script, no service account, no API key. It rides on the active `gcloud` login, so it
works for whichever account is logged in on the machine. Every exported file gets a
`https://storage.googleapis.com/<bucket>/<key>` URL. The bucket is **private**: that URL is a
handle to store and pass around, and `import` turns it back into a local file on any machine
whose gcloud account can read the bucket. Nothing is reachable anonymously.

## Preconditions

- `gcloud` on PATH and logged in (`gcloud auth login`). If the credential has expired the
  script says so and stops.
- A project: `--project`, `GCP_PROJECT_ID` (environment or `~/.env`), or gcloud's
  `core/project`, in that order.
- A bucket: `--bucket`, `GCS_IMAGE_BUCKET` (environment or `~/.env`), or the default
  `<project>-images`. **Created on first use**, private, uniform access, public access
  prevention enforced. `GCS_IMAGE_LOCATION` sets the region (default `us-central1`).

Check what will be used before the first upload:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/image-exchange/scripts/image-exchange.sh whoami
```

## Commands

```bash
S=${CLAUDE_PLUGIN_ROOT}/skills/image-exchange/scripts/image-exchange.sh

bash $S export <file>... [--prefix p] [--name n] [--json]   # local → URL (one per line)
bash $S import <url|gs://...>... [--out dir] [--json]       # URL → local path (one per line)
bash $S list [prefix] [--limit n]                           # newest URLs under a prefix
bash $S setup                                               # create the bucket now, print config
bash $S whoami                                              # account, project, bucket, base URL
```

| Flag | Meaning |
|---|---|
| `--prefix p` | Folder inside the bucket. Default `images`. Use one per purpose: `bugs`, `renders`, `diagrams` |
| `--name n` | Object name instead of the generated `<timestamp>-<slug>.<ext>` (single file only) |
| `--out dir` | Where `import` writes. Default `./imported-images` |
| `--json` | Machine-readable output instead of one line per file |
| `--project`, `--bucket` | Override the resolved project or bucket for this call |

`import` accepts `https://storage.googleapis.com/…`, `https://storage.cloud.google.com/…`,
`gs://…`, and any other `https://` URL (fetched with curl). Bucket URLs download through
gcloud, which is what makes the private bucket readable; plain HTTP is only a last resort for
objects that happen to be public.

URLs print to **stdout**, progress and errors to **stderr**. Read stdout for the result.

## Workflow: file a bug with a screenshot (export)

The usual case: working on a project, a visual bug shows up in another app (typically Potion),
and it must be logged with a picture so it can be fixed later.

1. **Get the screenshot as a local file.** The user usually gives a path, or it comes from a
   browser or device capture (the `ios-device` skill saves screenshots to disk).
2. **Export it:**

   ```bash
   bash $S export ~/Desktop/shot.png --prefix bugs
   ```

   Take the URL from stdout.
3. **Write the record** in the Potion workspace that holds bugs (the `potion-home` MCP, the
   `bug` structure). Call `list_structures` first to confirm the name, then `write_record`:

   ```json
   { "structure": "bug",
     "data": { "date": "2026-09-20", "type": "visual", "project": "potion", "status": "open",
               "description": "Sidebar pin icon clips at narrow width; repro: resize to 900px",
               "image_url": "https://storage.googleapis.com/<bucket>/bugs/20260920-...-shot.png" } }
   ```

   Fields: `date` (required), `type` (`visual` | `functional` | `performance` | `data` |
   `other`, required), `description` (required), `image_url`, `project`, `status`
   (`open` | `fixed` | `wontfix`). The structure already exists in the potion-home workspace;
   never create a second one. If the user did not give a project or description, ask
   rather than guess; a record with a missing required field is refused and nothing is written.
4. Report the URL and that the record was written. If the image should also appear inside a
   note, embed it with a size hint: `![shot|400](<url>)`.

## Workflow: pick a bug up and look at its screenshot (import)

Later, from the project that owns the bug:

1. `list_records` on `bug`, filtered to `status eq open` (and `project` if relevant), to find
   the row.
2. **Import its image:**

   ```bash
   bash $S import "<image_url>" --out ./imported-images
   ```

3. **Look at it** with the `Read` tool on the printed path: images render, so the picture is
   now evidence to fix against.
4. When the fix ships, `update_record` sets `status` to `fixed`.

## Behaviour to know

- **Names are stable and sortable.** Generated keys are `<YYYYMMDD-HHMMSS>-<slug>.<ext>`, so
  `list` shows newest first and the filename still says what the image was.
- **The URL is not fetchable without gcloud.** An anonymous `curl` gets `403`; a browser
  shows the object only for a logged-in Google account with access. Any consumer of the URL
  (another project's skill, another agent) must run `import` on a machine logged into
  gcloud, not fetch the URL directly.
- **Content-Type comes from the extension.** Keep real extensions (`.png`, `.jpg`, `.webp`,
  `.svg`, `.gif`); a file without one uploads as `application/octet-stream` and models will not
  see it as an image.
- **Not just images.** PDFs and other files go through the same path; only the name of the
  skill is image-shaped.
- **Other projects consume this skill through the script.** A project that reads bugs (for
  example a custom skill inside the Potion repo) should call `import <image_url>` and then
  read the local file, rather than reimplementing access.
