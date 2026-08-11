#!/usr/bin/env bash
# Play the bundled "input needed" chime when Claude is waiting for the user.
# Wired to the Notification hook event. Cross-platform with a graceful fallback.
#
# Design notes:
# - Reads and discards stdin (hooks receive a JSON payload there).
# - Plays in the background and exits 0 immediately so it never delays the prompt.
# - Stays silent on stdout/stderr; a missing audio player must not break the session.
set -uo pipefail

# Drain stdin so the hook payload doesn't linger on the pipe.
cat >/dev/null 2>&1 || true

# Resolve the bundled sound. CLAUDE_PLUGIN_ROOT is set by Claude Code for plugin
# hooks; fall back to a path relative to this script when run standalone.
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SOUND="$PLUGIN_ROOT/assets/input-needed.wav"

# Allow opting out without uninstalling the plugin.
if [ "${SESSION_SOUND_DISABLED:-}" = "1" ]; then
  exit 0
fi

play() {
  if command -v afplay >/dev/null 2>&1; then            # macOS
    afplay "$SOUND"
  elif command -v paplay >/dev/null 2>&1; then          # Linux (PulseAudio/PipeWire)
    paplay "$SOUND"
  elif command -v aplay >/dev/null 2>&1; then            # Linux (ALSA)
    aplay -q "$SOUND"
  elif command -v ffplay >/dev/null 2>&1; then           # ffmpeg
    ffplay -nodisp -autoexit -loglevel quiet "$SOUND"
  elif command -v powershell.exe >/dev/null 2>&1; then   # Windows (WSL/Git Bash)
    # Escape single quotes for the PowerShell single-quoted string literal.
    local ps_sound="${SOUND//\'/\'\'}"
    powershell.exe -NoProfile -C "(New-Object Media.SoundPlayer '$ps_sound').PlaySync()"
  else
    printf '\a'                                          # last-resort terminal bell
  fi
}

# Detach so the hook returns instantly.
( play >/dev/null 2>&1 & ) >/dev/null 2>&1

exit 0
