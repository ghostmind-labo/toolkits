#!/usr/bin/env bash
# Turns the narration of each beat into audio and measures how long each clip lasts.
#   narrate.sh <beats.json> <audio-dir> [--local]
# beats.json is a list of {"id": "...", "say": "..."}. Writes <audio-dir>/<id>.mp3 and
# durations.json next to beats.json.
#
# The voice is ElevenLabs through OpenRouter's speech endpoint when OPENROUTER_API_KEY is
# set (the same call as hooks/speak.sh; NARRATE_MODEL and NARRATE_VOICE change it).
# Without a key, or with --local, it falls back to the macOS `say` voice, which is free.
set -euo pipefail
beats="$1" audio="$2" mode="${3:-}"
model="${NARRATE_MODEL:-elevenlabs/eleven-v4}" voice="${NARRATE_VOICE:-bill}"
mkdir -p "$audio"

speak() { # <text> <out.mp3>
  if [ "$mode" != "--local" ] && [ -n "${OPENROUTER_API_KEY:-}" ]; then
    curl -fsS --max-time 120 https://openrouter.ai/api/v1/audio/speech \
      -H "Authorization: Bearer $OPENROUTER_API_KEY" -H 'Content-Type: application/json' \
      -d "$(jq -n --arg m "$model" --arg v "$voice" --arg t "$1" \
            '{model:$m, voice:$v, input:$t, response_format:"mp3"}')" -o "$2"
  elif command -v say >/dev/null; then
    say -o "${2%.mp3}.aiff" "$1"
    ffmpeg -loglevel error -y -i "${2%.mp3}.aiff" "$2" && rm "${2%.mp3}.aiff"
  else
    echo "narrate.sh: set OPENROUTER_API_KEY, or run on macOS for the local voice" >&2; exit 1
  fi
}

while IFS=$'\t' read -r id text; do
  speak "$text" "$audio/$id.mp3"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$audio/$id.mp3")
  jq -n --arg id "$id" --arg d "$dur" '{($id): ($d | tonumber)}'
done < <(jq -r '.[] | [.id, .say] | @tsv' "$beats") | jq -s add > "$(dirname "$beats")/durations.json"
cat "$(dirname "$beats")/durations.json"
