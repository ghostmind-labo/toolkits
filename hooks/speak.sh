#!/bin/bash
# Reads the summary of a Claude Code reply aloud, on demand only.
#
#   speak.sh prompt   UserPromptSubmit hook: looks at what was typed
#   speak.sh stop     Stop hook: speaks the reply that just ended, if asked
#   speak.sh say <text>   speaks the text (for testing a voice)
#   speak.sh summary      prints what would be spoken for the reply on stdin
#
# How to ask for it:
#   - put "out loud" or "read it back" anywhere in a prompt: that one reply is spoken
#   - send "voice on" alone: every reply is spoken until "voice off"
#   - send "voice <name>" to change the voice (it introduces itself), "voice" to see the list
#
# What is spoken: the opening paragraph of the reply, which is where the summary is.
# The voice comes from OpenRouter's speech endpoint, with the OPENROUTER_API_KEY of the
# environment Claude Code runs in (Vault's shared key as a fallback).

MODEL="${SPEAK_MODEL:-elevenlabs/eleven-v4}"
VOICES="george sarah adam alice bella bill brian callum charlie chris daniel eric harry jessica laura liam lily matilda river roger will"
MAX_CHARS=700

STATE="$HOME/.claude/speak"
ALWAYS="$STATE/always"
LOG="$STATE/speak.log"
mkdir -p "$STATE"
# the voice chosen with "voice <name>", else george
VOICE="${SPEAK_VOICE:-$(cat "$STATE/voice" 2>/dev/null || echo george)}"

# The reply's summary as plain speech: first paragraph, markdown removed
summary_of() {
  python3 -c '
import re, sys
text = sys.stdin.read().strip()
limit = int(sys.argv[1])
# the first paragraph that is prose: not a heading, a table, a list or a code fence
chosen = ""
for block in re.split(r"\n\s*\n", text):
    block = block.strip()
    if not block or block.startswith(("#", "|", "```", "- ", "* ", ">")) or re.match(r"\d+\. ", block):
        continue
    chosen = block
    break
chosen = re.sub(r"`([^`]*)`", r"\1", chosen)                # code spans
chosen = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", chosen)   # links keep their text
chosen = re.sub(r"https?://\S+", "a link", chosen)
chosen = re.sub(r"[*_#]+", "", chosen)
chosen = re.sub(r"\s+", " ", chosen).strip()
if len(chosen) > limit:
    cut = chosen[:limit]
    chosen = cut[: cut.rfind(". ") + 1] or cut
print(chosen)
' "$MAX_CHARS"
}

say() {
  local text="$1" key out
  [ ${#text} -ge 20 ] || return 0
  # the key Claude Code was started with, else the shared one in Vault
  key="${OPENROUTER_API_KEY:-$(vault kv get -field=OPENROUTER_API_KEY ghostmind/global/openrouter 2>>"$LOG")}"
  [ -n "$key" ] || { echo "$(date '+%F %T') no OpenRouter key in the environment or Vault" >>"$LOG"; return 1; }
  out="$STATE/last.mp3"
  if ! curl -fsS --max-time 40 https://openrouter.ai/api/v1/audio/speech \
      -H "Authorization: Bearer $key" -H 'Content-Type: application/json' \
      -d "$(jq -n --arg m "$MODEL" --arg v "$VOICE" --arg t "$text" \
            '{model:$m, voice:$v, input:$t, response_format:"mp3"}')" \
      -o "$out.part" 2>>"$LOG"; then
    echo "$(date '+%F %T') speech request failed ($MODEL)" >>"$LOG"; return 1
  fi
  mv "$out.part" "$out"
  # a new reply replaces one still being read
  pkill -f "afplay $out" 2>/dev/null
  afplay "$out"
}

case "${1:-}" in
  prompt)
    input="$(cat)"
    prompt="$(jq -r '.prompt // ""' <<<"$input")"
    session="$(jq -r '.session_id // "none"' <<<"$input")"
    lowered="$(tr '[:upper:]' '[:lower:]' <<<"$prompt" | sed -E 's/^[[:space:]]+|[[:space:].!]+$//g')"
    case "$lowered" in
      "voice on")
        touch "$ALWAYS"
        jq -n '{decision:"block", reason:"Voice is on: the summary of every reply will be read aloud. Send \"voice off\" to stop."}'
        exit 0 ;;
      "voice off")
        rm -f "$ALWAYS"; pkill -f "afplay $STATE/last.mp3" 2>/dev/null
        jq -n '{decision:"block", reason:"Voice is off. Put \"out loud\" in a prompt to hear that one reply."}'
        exit 0 ;;
    esac
    case "$lowered" in
      "voice"|"voice list"|"voices")
        jq -n --arg r "Voice is $([ -e "$ALWAYS" ] && echo on || echo off), speaking as $VOICE. Voices: $VOICES. Send \"voice <name>\" to change." '{decision:"block", reason:$r}'
        exit 0 ;;
      voice\ *)
        wanted="${lowered#voice }"
        if grep -qw -- "$wanted" <<<"$VOICES" && [ "${wanted// /}" = "$wanted" ]; then
          echo "$wanted" > "$STATE/voice"
          jq -n --arg r "Voice changed to $wanted." '{decision:"block", reason:$r}'
          VOICE="$wanted"; ( say "This is $wanted. I will read your summaries from now on." ) >/dev/null 2>&1 & disown
          exit 0
        fi ;;
    esac
    if grep -qiE 'out loud|read it back' <<<"$prompt"; then touch "$STATE/once-$session"; fi
    ;;

  stop)
    input="$(cat)"
    session="$(jq -r '.session_id // "none"' <<<"$input")"
    [ -e "$ALWAYS" ] || [ -e "$STATE/once-$session" ] || exit 0
    rm -f "$STATE/once-$session"
    reply="$(jq -r '.last_assistant_message // ""' <<<"$input")"
    if [ -z "$reply" ]; then
      transcript="$(jq -r '.transcript_path // ""' <<<"$input")"
      [ -f "$transcript" ] || exit 0
      # the last assistant entry that carries text
      reply="$(tail -n 200 "$transcript" | jq -rs '
        [ .[] | select(.type=="assistant") | [ .message.content[]? | select(.type=="text") | .text ] | join("\n\n") | select(length>0) ] | last // ""')"
    fi
    text="$(summary_of <<<"$reply")"
    # never hold the terminal: the request and the playback run on their own
    ( say "$text" ) >/dev/null 2>&1 &
    disown
    ;;

  say)
    shift; say "$*" ;;

  summary)
    summary_of ;;

  *)
    echo "usage: speak.sh prompt|stop|say <text>|summary" >&2; exit 2 ;;
esac
