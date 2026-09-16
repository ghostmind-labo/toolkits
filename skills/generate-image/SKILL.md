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

## Present the result

1. Print the saved path(s); read the image back to check it matches the request before calling it done.
2. Offer the obvious next step: variations (`--n 3`), a different model (`--compare`), or an edit.
3. Mention cost only when the user is generating in bulk or at 4K.

## Additional Resources

- **`references/models.md`** — every model id, what it is best at, verified pricing, API request
  and response shapes for both providers, and the limits. Read before adding a provider or
  changing the routing table.
