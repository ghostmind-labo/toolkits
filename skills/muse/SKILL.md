---
name: muse
description: >-
  Make a piece of work with one influential figure from history at its core: pick a random era,
  take an artist, engineer, scientist, cook or thinker whose influence outlived them, and let
  their techniques and convictions shape the work, whatever it is (a recipe, a UI, a piece of
  music, a Potion note, a text, a plan). Use this skill when the user runs /muse or
  /toolkits:muse, or says "use a muse", "channel someone", "do it in the spirit of someone",
  "pick an artist and make this", "give it an influence", "surprise me with a style", "make it
  like a master would", or asks for something with a random, unexpected or historical
  inspiration. Also use it when the user names the figure ("a recipe the way Bach would write
  it") and wants that person's way of working, not a quote or a costume.
---

# Muse

The work the user asks for stays the work. What changes is who stands behind it: one person
from history, picked at random unless the user names one, whose way of working goes into the
core of the piece.

The people worth picking are the ones whose influence lasted. Often nobody saw it while they
lived. What lasted is rarely the surface of what they made. It is how they made decisions, and
that is the part to take.

## 1. Pick the figure

If the user named a person, an era or a field, start from that and skip the draw.

Otherwise, draw. Left alone, the choice falls on the same famous few each time, so let the
script decide where to look:

```bash
"$SKILL_DIR/scripts/draw.sh"     # three draws: era · part of the world · discipline
```

Take the first draw for which you can name a real person you know well, and whose influence
is established. If none of the three gives one, draw again. Do not bend the draw toward a
name you already had in mind.

Rules for the choice:

- **A real person, and one you know.** You must be able to state how they worked, not only
  what they are famous for. If you are not sure the person existed or did what you think,
  pick another. Never invent a figure or a fact about one.
- **Dead, with a legacy.** The influence must be visible in what came after them. This also
  keeps the skill away from the style of people who are alive and working.
- **The figure's field does not have to match the work.** A draw of "cartography" for a recipe
  is good. The distance between the two is where the surprise comes from.
- **Not the obvious one.** If the draw allows the name everybody knows and a name few know,
  take the second when you know it as well.

## 2. Find the core

Write down, for yourself, three to five things that made this person's work theirs. Look for
method and conviction:

- what they started from, and what they refused to do
- how they treated their material, and what they left out
- how they ordered a piece: what comes first, what repeats, where the weight sits
- how they treated the person on the other side: the listener, the reader, the user
- the constraint they chose, or the one their time gave them

Leave out the trademarks: the famous motif, the signature colour, the catchphrase. Those make
a costume. A good test: someone who knows the figure should recognise them in the result, and
someone who does not should see only a good piece of work with a clear point of view.

## 3. Carry it into the work

Translate each principle into a decision in the medium the user asked for. The substance stays
that of the request; the principles govern technique, structure and presentation.

- **A recipe.** The dish and what an ingredient is stay real: it is still food someone can
  cook tonight. The figure decides the technique, the order of the work, how few or how many
  things are on the plate, how it is served and how the recipe is written.
- **A UI.** It still does the job and is still usable. The figure decides the hierarchy, the
  rhythm of the layout, what gets removed, how the material (type, colour, motion) is handled.
- **Music.** The figure decides form, voice leading, repetition, silence; not a quotation of
  their tunes.
- **A Potion note.** The content is what the user wanted to keep. The figure decides how the
  note is built: its order, its headings, where it uses a table, a diagram or a live block,
  how much it says. Create it through the `potion` skill as usual.
- **Text, a plan, code, anything else.** The same: correct first, then shaped by the method.

Apply the principles all the way through, in the structure, and do not sprinkle references on
a piece that was made the usual way. Do not write in the figure's voice, do not write a
pastiche, and do not put their name in the piece itself unless the user asks.

The request wins over the muse. When a principle would make the work wrong, unsafe or
unusable, drop that principle and keep the others.

## 4. Say who it was

After the work, add a short note, outside the piece:

> **Muse:** <name> (<years>, <what they did>). <One sentence on why their influence lasted.>
> **What came from them:** <two or three decisions in this piece, each tied to a principle.>

Keep it to those lines. The work is the answer; the note is the credit.

If the user wants another take, draw again and keep the request the same. If they liked the
figure, keep the figure for the rest of the session without a new draw.
