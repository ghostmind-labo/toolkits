# Explainer video recipe

A narrated animation: Manim Community draws it, a speech model reads it, ffmpeg joins them.
The video follows the narration, not the other way round: the voice is made first, each clip
is measured, and each beat of the animation lasts as long as its clip.

## Requirements

- `uv`, `ffmpeg`, `jq`.
- The cairo library (`brew install cairo` on macOS). `scripts/manim.sh`
  takes care of pkg-config, so nothing else is installed globally. The first run builds
  pycairo and takes about a minute; later runs start at once.
- For the good voice, `OPENROUTER_API_KEY`. Without it the macOS `say` voice is used.
- LaTeX is needed only for `MathTex` and `Tex`. Without it, write formulas with `Text` or
  `MarkupText`. Check with `which latex` before you use `MathTex`.

Work in a scratch folder, not in the repository. `SKILL_DIR` below is this skill's folder.

## 1. Script

Write the narration before any animation, as `beats.json`. A beat is one idea and one or two
spoken sentences, 5 to 12 seconds. A good explainer has 8 to 20 beats (1 to 3 minutes).

```json
[
  {"id": "intro", "say": "Binary search finds a value in a sorted list."},
  {"id": "halve", "say": "Each step looks at the middle and throws away half of the list."}
]
```

Write for the ear: short sentences, no symbols that a voice cannot read, numbers that are easy
to say. Open with the question the video answers, and end with the one sentence to remember.

## 2. Voice

```bash
"$SKILL_DIR/scripts/narrate.sh" beats.json audio --local   # draft, free
"$SKILL_DIR/scripts/narrate.sh" beats.json audio           # final, ElevenLabs through OpenRouter
```

It writes `audio/<id>.mp3` and `durations.json` (seconds for each beat). `NARRATE_VOICE`
(default `bill`) and `NARRATE_MODEL` (default `elevenlabs/eleven-v4`) change the voice. A user
with an ElevenLabs key and no OpenRouter key can call the ElevenLabs API directly; keep the
same output files.

Run it again each time the narration changes, because the durations change with it.

## 3. Scene

Start from this template. `beat()` plays the animations of a beat, holds until its narration
ends, and records when the beat started.

```python
import json
from manim import *

DUR = json.load(open("durations.json"))


class Explainer(Scene):
    starts = {}

    def beat(self, beat_id, *animations, run_time=1.5):
        """Play the animations, then hold until the narration of this beat ends."""
        self.starts[beat_id] = self.renderer.time
        if animations:
            self.play(*animations, run_time=run_time)
        else:
            run_time = 0
        self.wait(max(DUR[beat_id] - run_time, 0) + 0.4)

    def construct(self):
        title = Text("Binary search", font_size=48)
        self.beat("intro", Write(title))

        boxes = VGroup(*[Square(0.8) for _ in range(8)]).arrange(RIGHT, buff=0.1)
        self.play(title.animate.to_edge(UP), Create(boxes), run_time=1)
        self.beat("halve", boxes[3].animate.set_fill(BLUE, 0.6), FadeOut(boxes[4:]))

        json.dump(self.starts, open("starts.json", "w"))
```

What makes it read like 3Blue1Brown:

- Dark background, few colours, each colour tied to one object for the whole video.
- One new thing on screen for each beat. Build a figure up piece by piece; do not show it whole.
- Transform an object into the next one (`Transform`, `ReplacementTransform`,
  `.animate`) in place of a cut, so that the eye follows what changed.
- The picture shows what the voice says at that moment. Text on screen is labels, not sentences.
- Leave what the next beat needs on screen; fade out the rest.

For several animations inside one long beat, call `self.play` more than once and give `beat()`
the total as `run_time`, or split the beat in two.

## 4. Render

```bash
"$SKILL_DIR/scripts/manim.sh" -ql --media_dir media scene.py Explainer   # draft, 480p
"$SKILL_DIR/scripts/manim.sh" -qh --media_dir media scene.py Explainer   # final, 1080p
```

The file lands in `media/videos/scene/<quality>/Explainer.mp4`, and `starts.json` beside
`scene.py`.

## 5. Join

```bash
"$SKILL_DIR/scripts/mux.sh" media/videos/scene/480p15/Explainer.mp4 starts.json audio out.mp4
```

## 6. Check before you show it

Do not hand over a video you have not looked at.

- Pull frames and read them: `ffmpeg -i out.mp4 -vf fps=1/3 frames/f%03d.png`. Look for text
  that overlaps, objects that leave the frame, and leftovers from an earlier beat.
- Compare the lengths: `ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 out.mp4`.
  The audio must not be longer than the video.
- Then `open out.mp4`, and tell the user the length, the voice used and where the file is.
