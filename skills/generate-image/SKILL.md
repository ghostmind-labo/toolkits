---
name: generate-image
description: >-
  REQUIRED for all image generation and editing requests. This skill should be used whenever the
  user asks to "generate an image", "create a picture", "make a thumbnail", "draw a cartoon",
  "design an icon", "make a logo", "illustrate", "render a photo", "edit this image", "remove the
  background", or wants any visual asset — blog headers, YouTube thumbnails, posters, diagrams,
  stickers, patterns, product shots, character art. Routes each request to the best model across
  providers: Google's Nano Banana 2 / Pro (photorealism, illustration, volume) and OpenAI's
  GPT Image 2.5 (text inside images, layouts, editing). Requires GEMINI_API_KEY and/or
  OPENAI_API_KEY.
---

# Generate Image — multi-model router

One script, several providers, routed by what the image is for. No single model wins every job:
Google's models lead on photorealism and cost, OpenAI's on readable text and precise layout.

## Preconditions

- `deno` on PATH.
- At least one key, read from the environment or `~/.env`:
  - `GEMINI_API_KEY` — Google models.
  - `OPENAI_API_KEY` — OpenAI models. The account also needs credits; without them the API
    returns `429 You have no credits remaining` and the script falls back to a Google model.

## Run

```bash
deno run --allow-net --allow-env --allow-read --allow-write \
  ${CLAUDE_PLUGIN_ROOT}/skills/generate-image/scripts/generate.ts "<prompt>" [flags]
```

Saved file paths print to stdout, one per line. Default output directory is
`./generated-images` — pass `--out` to change it.

## Choose the route

Pass `--for <job>` and let the script pick the model. Match the user's request:

| The image is… | `--for` | Model used |
|---|---|---|
| A cartoon, sticker, character, or stylized illustration | `cartoon` / `illustration` | `gemini-3.1-flash-image` |
| A photoreal scene, product shot, or hero image | `photo` / `product` | `gemini-3-pro-image` |
| Anything with **readable words**: poster, thumbnail with a title, packaging | `text` / `poster` | `gpt-image-2.5-flare` |
| A diagram, flowchart, or UI mockup where placement matters | `diagram` / `ui` | `gpt-image-2.5-flare` |
| An app icon, favicon, or logo mark | `icon` | `gemini-3.1-flash-image` |
| A rough draft while iterating, or bulk variations | `draft` | `gemini-3.1-flash-lite-image` |
| An edit of an existing image (`--edit file.png`) | `edit` | `gpt-image-2.5-sunburst` |

Default when `--for` is omitted: `illustration`.

### Other flags

| Flag | Use |
|---|---|
| `--model <id>` | Force one model, ignoring the routing table |
| `--compare a,b[,c]` | Same prompt through several models in parallel — use when the user wants options or asks which model is better |
| `--n 1-8` | Variations (Google loops requests; OpenAI uses `n`) |
| `--aspect 16:9` | Aspect ratio (Google only: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`) |
| `--size 1K\|2K\|4K` | Google resolution. For OpenAI pass pixels instead: `1024x1024`, `1536x1024`, `1024x1536` |
| `--quality low\|medium\|high` | OpenAI only — drives cost heavily |
| `--edit <file>` | Supply an input image to edit; works with both providers |
| `--out <dir>` | Output directory (default `generated-images`) |
| `--json` | Machine-readable result |

## Behaviour to know

- **OpenAI failures fall back to Google.** Any error on a `gpt-image-*` model (no key, no credits,
  rate limit) retries once on `gemini-3-pro-image` and notes the fallback on stderr. Report that
  substitution to the user — the result came from a different model than requested.
- **`--compare` runs models in parallel** and reports per-model failures without losing the
  successes.
- **Filenames** are `<timestamp>-<prompt-slug>-<model>.png`, so comparisons stay identifiable.
- **Keys** come from the environment first, then `~/.env`.

## Prompting

- State subject, style, composition, lighting, and palette. Vague prompts waste money.
- Add "no text" when words should not appear — Google's models add captions otherwise.
- For text in an image, put the exact wording in quotes in the prompt and route to OpenAI.
- For a series that must look consistent (a character, a brand set), generate once, then use
  `--edit` on that output rather than re-rolling from scratch.

## Post-process with edit.py

Generation is half the job. `scripts/edit.py` handles everything that follows — cutting,
adjusting, converting — locally with Pillow, with no API cost and no round trip.

```bash
uv run --script ${CLAUDE_PLUGIN_ROOT}/skills/generate-image/scripts/edit.py <command> <file> [flags]
```

**Always invoke it through `uv run --script`.** The script declares its own dependencies
(Pillow, numpy, smartcrop, vtracer) in a PEP 723 header, so uv installs them into a cached
environment on first use — nothing is installed globally and no setup step is needed. Plain
`python3` works only for the Pillow-based commands.

| The user wants… | Command |
|---|---|
| "Cut this in four" / a grid of tiles | `split file.png --rows 2 --cols 2` |
| More punch, brighter, more vivid, sharper | `adjust file.png --contrast 1.3 --saturation 1.2 --brightness 1.05 --sharpness 1.5` |
| Black and white | `adjust file.png --grayscale` |
| A different size | `resize file.png --width 1280` (or `--scale 2`, `--fit cover` with both dimensions) |
| A different shape, cropping to fit | `crop file.png --aspect 16:9 --gravity center` |
| The crop to keep the subject, not the middle | `smart-crop file.png --aspect 16:9` |
| A different shape without losing anything | `pad file.png --aspect 16:9 --color "#ffffff"` (or `transparent`) |
| The whitespace or transparent border gone | `trim file.png` |
| Smaller file / another format | `convert file.png --format webp --quality 80` |
| An app icon at every size | `icon-set file.png --sizes 16,32,64,128,256,512` |
| A logo that scales — vector, not pixels | `trace file.png --out logo.svg` (`--colormode binary` for flat marks) |
| The colors used, as hex | `palette file.png --count 6 [--out swatches.png]` |
| Models compared side by side | `sheet a.png b.png --labels "nano banana,gpt image"` |
| One PDF to send someone | `pdf a.png b.png --out deck.pdf` |
| The background removed | `bg-remove file.png` |

Every command prints the path it wrote and derives the output name from the input
(`fox.jpg` → `fox-trim.jpg`), unless `--out` is given. `info` reports dimensions and file size.

**`bg-remove` shells out to `rembg[cpu,cli]`** (`--backend gpu` on CUDA machines), run through
`uvx` so it stays out of the main environment. The **first** run downloads onnxruntime plus a
~1 GB model and can take several minutes on a slow link — warn the user rather than letting
them think it hung; a download that times out mid-way leaves a 0-byte output, so re-run it.
Once cached, a 1024² image takes ~20 s.

It isolates **a subject**, so it suits characters, products, logos and stickers. On a wide scene
with no single subject it keeps whatever it judges foreground (on a café interior it kept the
table and chair and deleted the rest), which is rarely what the user wanted. For a background
that needs judgment rather than a cutout — replacing a scene instead of deleting it — use
`--edit` on the generation script.

**Chain freely:** generate, then `trim`, then `pad` to the ratio the user needs. Prefer these
local operations over regenerating — they cost nothing and keep the image the user already
approved.

## Present the result

1. Print the saved path(s); read the image back to check it matches the request before calling it done.
2. Offer the obvious next step: variations (`--n 3`), a different model (`--compare`), or an edit.
3. Mention cost only when the user is generating in bulk or at 4K.

## Additional Resources

- **`references/models.md`** — every model id, what it is best at, verified pricing, API request
  and response shapes for both providers, and the limits. Read before adding a provider or
  changing the routing table.
