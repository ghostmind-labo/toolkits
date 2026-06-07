# session

Session quality-of-life enhancements for Claude Code.

## What it does

Plays a **gentle, joyful chime** whenever Claude is waiting for your input — when it
needs permission to run something, or otherwise hands the turn back to you. Step away
from the terminal and let the sound bring you back the moment your attention is needed.

The sound is wired to Claude Code's **`Notification`** hook event.

## The sound

A short (~0.9s) ascending C-major arpeggio with a soft, bell-like decay — bundled as
`assets/input-needed.wav` (44.1 kHz, 16-bit mono). It's intentionally **quiet and
unobtrusive**.

### Regenerate or customize

The asset is reproducible — no audio editing needed:

```bash
python3 scripts/generate-chime.py
```

Tweak the constants at the top of the script to change it:
- `AMPLITUDE` — overall volume (lower = softer; default `0.13`)
- `NOTES` — the arpeggio pitches
- `DECAY` — how fast each note fades
- `NOTE_DURATION` / `NOTE_SPACING` — length and overlap

## Cross-platform playback

`hooks/play-sound.sh` picks the first available player and falls back gracefully:

| Platform | Player used |
|----------|-------------|
| macOS | `afplay` |
| Linux (PulseAudio/PipeWire) | `paplay` |
| Linux (ALSA) | `aplay` |
| Any with ffmpeg | `ffplay` |
| Windows (WSL/Git Bash) | `powershell.exe` SoundPlayer |
| None of the above | terminal bell (`\a`) |

The hook plays in the background and exits immediately, so it never delays your prompt.

## Disabling temporarily

Export this in your shell to mute the chime without uninstalling the plugin:

```bash
export SESSION_SOUND_DISABLED=1
```

## Installation

Part of the `ghostmind-toolkits` marketplace. Enable the `session` plugin, or test locally:

```bash
cc --plugin-dir plugins/session
```

> **Note:** Hooks load at session start. After enabling the plugin (or editing the hook),
> restart Claude Code for the chime to take effect.
