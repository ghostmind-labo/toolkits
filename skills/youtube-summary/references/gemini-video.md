# Gemini video understanding — API reference

Verified against the live API on 2026-09-15. Official docs:
- https://ai.google.dev/gemini-api/docs/video-understanding
- https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-agentic-video-in-gemini/

## Processing modes

| Mode | How it works | Cost | Clipping |
|---|---|---|---|
| **agentic** | Model calls native video tools to search, scan, and inspect segments across frames, audio, and transcript | Google reports up to 88% fewer tokens / 66% lower cost and up to 7% better accuracy vs static, mostly on 10 min+ videos | No |
| **static** | Fixed-rate sampling, 1 frame/s plus audio | ~100 tokens per second of video at default (low) media resolution | Yes (`generateContent` only) |

Agentic video understanding launched 2026-09-01. Announced models: Gemini 3.7 Flash,
3.6 Flash, 3.5 Flash-Lite. `gemini-3.8-flash` also accepts it (tested). No extra fee beyond
token pricing.

## Interactions API (agentic or static)

```bash
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/interactions" \
  -H "x-goog-api-key: $GEMINI_API_KEY" -H 'Content-Type: application/json' \
  -d '{
    "model": "gemini-3.8-flash",
    "input": [
      {"type": "video", "uri": "https://www.youtube.com/watch?v=9hE5-98ZeCg", "processing": "agentic"},
      {"type": "text", "text": "Summarize this video."}
    ]
  }'
```

Omit `"processing"` for static. Response (signatures elided):

```json
{
  "id": "v1_…", "object": "interaction", "status": "completed", "model": "gemini-3.8-flash",
  "steps": [
    {"type": "processing_call", "id": "call_13407"},
    {"type": "processing_result", "call_id": "call_13407"},
    {"type": "thought"},
    {"type": "model_output", "content": [{"type": "text", "text": "…"}]}
  ],
  "usage": {"total_tokens": 1258, "total_thought_tokens": 982, "total_output_tokens": 84}
}
```

The answer is the concatenated `text` of `model_output` steps. `processing_call` /
`processing_result` steps are the evidence agentic mode ran. The Python SDK exposes the same
as `client.interactions.create(...).output_text`.

## generateContent (static, supports clipping)

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" -H 'Content-Type: application/json' \
  -d '{
    "contents": [{"parts": [
      {"fileData": {"fileUri": "https://www.youtube.com/watch?v=XEzRZ35urlk"},
       "videoMetadata": {"startOffset": "1250s", "endOffset": "1570s"}},
      {"text": "Summarize this segment."}
    ]}]
  }'
```

Answer at `candidates[0].content.parts[].text`; tokens at `usageMetadata.totalTokenCount`.

## Limits

- Public videos only — private and unlisted are rejected.
- Free tier: at most 8 hours of YouTube video per day. Paid tier: no length-based limit.
- Up to 10 videos per request on Gemini 2.5+ (the script sends one).
- Static mode on 1M-context models: ~1 h of video at default resolution, ~3 h at low resolution.
- Refer to moments in prompts with `MM:SS` timestamps.

## Listing models available to a key

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200" \
  -H "x-goog-api-key: $GEMINI_API_KEY" | jq -r '.models[].name'
```
