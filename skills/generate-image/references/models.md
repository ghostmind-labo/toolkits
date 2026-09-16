# Image models — capabilities, pricing, API shapes

Verified against the live APIs on 2026-09-15 unless marked otherwise.

## Which model for which job

| Model | Provider | Best at | Cost per image | Speed |
|---|---|---|---|---|
| `gpt-image-2.5-flare` | OpenAI | Fast default for high-quality generation; readable text, layout, prompt adherence. Up to 50% lower latency than GPT Image 2. | token-based (below) | fast |
| `gpt-image-2.5-sunburst` | OpenAI | Editing precision, premium creative work | token-based | slow |
| `gpt-image-2` | OpenAI | Previous flagship; topped the Image Arena at Elo 1339 | ~$0.006 low / $0.053 medium / $0.211 high at 1024² | medium |
| `gemini-3-pro-image` (Nano Banana Pro) | Google | Fine typography, multi-logo accuracy, dense instructions, max visual quality | $0.134 at 2K, $0.24 at 4K | 8-15 s |
| `gemini-3.1-flash-image` (Nano Banana 2) | Google | Photorealism, skin, materials, cinematic light, product heroes; the volume workhorse | $0.045 (0.5K) / $0.067 (1K) / $0.101 (2K) / $0.151 (4K) | 2-5 s |
| `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) | Google | Cheapest drafts and bulk iteration | ~$0.034 at 1K | ~4 s |

OpenAI token rates (both 2.5 models): $30/M image-output tokens, $8/M image-input, $2/M cached
image-input, $5/M text-input. Google offers 50% off via the Batch API.

**Not wired in, worth knowing:** FLUX.2 Pro (Black Forest Labs, ~$0.03 per 1024², photorealism
leader, needs `BFL_API_KEY`), Ideogram V3 (~90% text accuracy vs ~30% for Midjourney),
Midjourney V8 (best aesthetics, no official API).

## Google — generateContent

```bash
curl -sS -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" -H 'Content-Type: application/json' \
  -d '{
    "contents": [{"parts": [{"text": "a red fox sticker, flat vector"}]}],
    "generationConfig": {
      "responseModalities": ["IMAGE"],
      "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"}
    }
  }'
```

Response: `candidates[0].content.parts[]` holds `{inlineData: {mimeType, data}}` (base64) plus a
`thoughtSignature` part. `mimeType` came back as `image/jpeg` in testing, so derive the file
extension from it rather than assuming PNG.

Verified: `imageConfig.aspectRatio` `16:9` and `imageSize` `2K` / `4K` all return HTTP 200.
Payload sizes observed: ~1.5 MB at default, ~4.6 MB at 2K, ~17 MB at 4K.

**Editing:** prepend an `inlineData` part (base64 source image) before the text part in the same
`contents[0].parts` array.

**No `n` parameter** — loop the request for variations.

## OpenAI — images/generations

```bash
curl -sS -X POST https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model": "gpt-image-2.5-flare", "prompt": "…", "n": 1, "size": "1024x1024", "quality": "high"}'
```

- `size`: `1024x1024`, `1536x1024`, `1024x1536`; GPT Image 2 added sizes up to 2000 px.
- `quality`: `low`, `medium`, `high`, `xhigh`, `max`, `auto`.
- `output_format`: `png`, `jpeg`, `webp`; `output_compression` 0-100 for jpeg/webp.
- `n`: up to 10, sharing a style.
- `thinking`: `off` / `low` / `medium` / `high` (GPT Image 2+). High thinking plus a large size
  can cost 4-5x a baseline render.
- Response returns **base64 in `data[].b64_json` by default**; `response_format` is supported.

**Editing:** `POST /v1/images/edits`, multipart, with `image` (one or more files) and an optional
`mask` carrying an alpha channel. Image and mask must share format and size, under 50 MB.

## Known failure modes

| Error | Meaning |
|---|---|
| `429 You have no credits remaining` | OpenAI account needs billing credits; the key itself is valid |
| `400 … model not found` | Model id not enabled for the key — list with `GET /v1/models` or Google's `/v1beta/models` |
| Google returns no `inlineData` part | Prompt blocked by safety filters, or `responseModalities` omitted |

## Listing what a key can use

```bash
curl -s https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY" | jq -r '.data[].id' | grep image
curl -s "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200" -H "x-goog-api-key: $GEMINI_API_KEY" | jq -r '.models[].name' | grep image
```
