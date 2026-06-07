#!/usr/bin/env python3
"""Generate the bundled 'input needed' chime.

Synthesizes a short, joyful ascending major arpeggio (C-E-G-C) with a bright,
bell-like exponential decay. Pure standard library — no dependencies. Re-run to
regenerate or tweak the asset:

    python3 scripts/generate-chime.py

Writes assets/input-needed.wav (44.1 kHz, 16-bit mono).
"""
import math
import os
import struct
import wave

SAMPLE_RATE = 44100
AMPLITUDE = 0.13  # very soft — a subtle, unobtrusive chime

# Ascending C-major arpeggio, ending an octave up — reads as cheerful/resolved.
NOTES = [523.25, 659.25, 783.99, 1046.50]  # C5, E5, G5, C6
NOTE_SPACING = 0.11   # seconds between note onsets (notes overlap and ring together)
NOTE_DURATION = 0.55  # seconds each note rings before fully decaying
DECAY = 6.0           # higher = faster, more percussive bell decay

OUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets",
    "input-needed.wav",
)


def main() -> None:
    total_seconds = NOTE_SPACING * (len(NOTES) - 1) + NOTE_DURATION
    total_samples = int(total_seconds * SAMPLE_RATE)
    buffer = [0.0] * total_samples

    for index, freq in enumerate(NOTES):
        start = int(index * NOTE_SPACING * SAMPLE_RATE)
        for n in range(int(NOTE_DURATION * SAMPLE_RATE)):
            pos = start + n
            if pos >= total_samples:
                break
            t = n / SAMPLE_RATE
            env = math.exp(-DECAY * t)  # bell-like exponential decay
            # Fundamental plus a soft second harmonic for a brighter, sweeter tone.
            sample = math.sin(2 * math.pi * freq * t)
            sample += 0.3 * math.sin(2 * math.pi * 2 * freq * t)
            buffer[pos] += env * sample

    # Normalize to target amplitude to keep overlapping notes from clipping.
    peak = max(abs(s) for s in buffer) or 1.0
    scale = AMPLITUDE / peak

    with wave.open(OUT_PATH, "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for s in buffer:
            value = int(max(-1.0, min(1.0, s * scale)) * 32767)
            frames += struct.pack("<h", value)
        wav.writeframes(bytes(frames))

    print(f"Wrote {OUT_PATH} ({total_seconds:.2f}s, {os.path.getsize(OUT_PATH)} bytes)")


if __name__ == "__main__":
    main()
