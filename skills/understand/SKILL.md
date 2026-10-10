---
name: understand
description: >-
  Explain something in the format that is easiest to take in, instead of a wall of prose:
  plain controlled English (ASD-STE100), a diagram, an interactive HTML page, or a narrated
  3Blue1Brown-style explainer video. Use this skill whenever the user asks to "help me
  understand", "make this easier to read", "explain this in STE", "write this in Simplified
  Technical English", "draw me a diagram of", "show me visually", "explain this as a web page",
  "explain this in HTML", "make an explainer video", "3b1b style video on X", "animate how X
  works", or says an answer, a diff, a plan or a piece of model output is too dense, too long
  or hard to follow. For pitching an explanation at a particular audience (a child, a manager),
  the eli5 skill is the better fit; this one chooses the medium.
---

# Understand

More and more of the work is reading what a model produced and deciding if it is right. This
skill spends effort on that side: it turns an answer into the form that costs the reader the
least. The idea and the four formats come from a note by Andrej Karpathy: intelligence and
code are now cheap, so a large, custom, throwaway artifact made for one explanation is worth
making.

## The ladder

Each rung costs more to make and less to read. Take the lowest rung that carries the subject,
and go straight to the one the user names.

| Rung | Format | Good for | Cost |
|---|---|---|---|
| 1 | Prose in ASD-STE100 | procedures, definitions, a summary of a change, anything read once | seconds |
| 2 | Diagram | structure, flow, a sequence between parts, state, a comparison | under a minute |
| 3 | HTML page | several linked ideas, data to explore, something to poke at, a thing to share | minutes |
| 4 | Explainer video | a process that unfolds in time, a geometric or mathematical intuition | several minutes, and maybe speech credit |

How to choose when the user did not:

- The subject is a list of steps or a set of facts: rung 1.
- The reader needs to see how parts connect: rung 2. A diagram can sit inside a rung 1 answer.
- There are more ideas than one picture holds, or the reader should change an input and watch
  the result: rung 3.
- The understanding is in the motion (an algorithm that runs, a transformation, a build-up):
  rung 4. Say what it will cost in time before starting, since it is the slow one.

Before making rungs 2 to 4, be sure of the content. A beautiful page that explains the thing
wrongly is worse than plain text. Read the code or the source first, then pick the two or three
ideas the reader must leave with, and build only around those.

## Rung 1: prose in ASD-STE100

ASD-STE100 (Simplified Technical English) is a controlled language made for aircraft
maintenance manuals. Its rules force short sentences, one meaning for each word and the active
voice, which is what makes model output easy to read. The rules are in
[references/ste100.md](references/ste100.md); read it before writing. A one-page picture of the
specification is in [references/ste100-overview.png](references/ste100-overview.png).

The full specification is strict: it has a dictionary of about 900 approved words. Outside
aerospace, write "80% of the way" to it by default:

- Keep all the writing rules: sentence length, one instruction for each sentence, active voice,
  simple tenses, no "-ing" verb forms, one word for one thing, lists for complex text.
- Relax the dictionary: use common words freely, and keep the technical terms of the subject as
  they are. Still replace the fancy word with the plain one ("use", not "utilize").

Go to 100% only when the user asks for strict STE. Then apply the dictionary rules too and say
which words you were not sure about, since the dictionary is not bundled here.

## Rung 2: diagram

Draw it as SVG, on its own or inside a small HTML file, so that the text stays sharp and the
user can open it in a browser. Mermaid is fine when the output goes to a place that renders it
(a GitHub file, a Potion note). For a picture that is more illustration than diagram, use the
`generate-image` skill.

- One diagram answers one question. Put that question in the title.
- Show the real names: the function, the table, the route, the file. No "Service A".
- Label the arrows with what moves along them.
- Use position and grouping before colour. Keep colour for one meaning, for example approved
  against not approved in the reference picture.
- Dense is good when it is ordered. The reference picture puts six panels on one sheet, each
  with a letter, a title and one job.

Then look at the result (open it, or render and read the image) before showing it. Overlapped
labels and arrows that cross the text are the usual faults.

## Rung 3: HTML page

Write one self-contained `.html` file: inline CSS and JavaScript, no build step. Save it where
the user asked, else in the scratchpad or a `.context/` folder, and open it (`open file.html`
on macOS). When an Artifact tool is available, publish the page with it so that there is a link.

- Start with the answer in two or three sentences, then let the reader go deeper.
- Make at least one thing interactive when it helps understanding: a slider on the input that
  matters, a step-through, a toggle between before and after, a hover that shows the detail.
  Interaction with no purpose is decoration; leave it out.
- Put diagrams from rung 2 inside the page in place of long paragraphs.
- Write the text of the page with the rung 1 rules.
- Support light and dark with `prefers-color-scheme`, and make it readable on a phone.
- The page is discardable. Do not add it to the repository unless the user asks.

## Rung 4: explainer video

A narrated animation in the style of 3Blue1Brown, made with Manim Community, the open version
of the library those videos use. The full recipe, the scene template and the checks are in
[references/video.md](references/video.md); read it before starting. The short form:

1. Write the script as beats: a list of `{"id", "say"}` in `beats.json`. One idea for each beat.
2. `scripts/narrate.sh beats.json audio` makes the voice and writes `durations.json`.
3. Write `scene.py` so that each beat lasts as long as its narration.
4. `scripts/manim.sh -qm scene.py Explainer` renders the silent video.
5. `scripts/mux.sh <video> starts.json audio out.mp4` lays the narration on it.

The voice is ElevenLabs through OpenRouter when `OPENROUTER_API_KEY` is set, and the free
macOS voice otherwise (or with `--local`). Draft with `--local` and low quality (`-ql`), watch
it, then make the final one with the good voice and `-qh`.

## After delivery

Say in one or two sentences what the artifact shows and where it is. Then ask nothing; the
user will say if another rung would serve better. If they do, reuse the same two or three
ideas and change only the medium.
