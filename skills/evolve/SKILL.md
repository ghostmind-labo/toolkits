---
name: evolve
description: >-
  Get the best result for a goal by evolving the way it is explained to an AI: write the goal
  as a brief, hand several variants of that brief to fresh agents, judge what comes back, keep
  the winner, tweak one thing, and run again, generation after generation. Use this skill when
  the user runs /evolve or /toolkits:evolve, or says "evolve this", "I want the best possible
  result", "iterate on this until it is good", "try several ways of asking", "tweak the prompt
  and see what works", "optimise this prompt", "breed a better prompt", "run variations and
  keep the best", or is not satisfied with a first result and wants a search, not one more
  attempt. Works for any output an agent can produce from a brief: a text, a name, a design,
  code, a plan, an image prompt, a system prompt.
---

# Evolve

One attempt at a goal is one sample. The result depends a lot on how the goal was explained,
and nobody knows in advance which explanation is best. So this skill does not try harder at
one explanation. It treats the explanation as something that evolves: several variants run,
the results are judged, the best one becomes the parent of the next round, and each round
changes one thing to learn if it helps.

You are the breeder. You do not produce the result yourself; fresh agents do, from the brief
alone. This matters: you know the whole conversation, so anything you make tells you nothing
about how good the brief is.

## 1. Fix the goal and the judge

Before any variant, write down two things and show them to the user in a few lines:

- **The goal**: what is wanted, for whom, and what it will be used for. Take it from what the
  user gave you. Ask only if you cannot tell what a good result would be.
- **The criteria**: three to five things a result is judged on, each one checkable on the
  output (for example "a cook can follow it without a second read"). Add any hard limit
  (length, format, things that must not appear). A result that breaks a hard limit loses.

The criteria do not change between generations. If they do, the scores of two generations
cannot be compared, and the search goes in circles.

## 2. Write the first brief

Explain the goal to an AI that knows nothing of this conversation: the situation, the reader
of the result, the material to work from (paste it, or give file paths), what good looks like,
and the form of the answer. Do not put the criteria list in as a checklist to tick; describe
the result that would meet them.

This brief is generation 0's parent.

## 3. Run a generation

Make the variants. Each is the parent with **one** change, so that a better result can be
traced to its cause. Changes worth trying:

| Gene | Examples of a tweak |
|---|---|
| Framing | who the agent is told it works for; the stakes; the audience named more exactly |
| Context | more of the background, or less; the source material in a different order |
| Examples | none, one good one, a good one and a bad one |
| Constraints | tighter (length, vocabulary, structure) or looser |
| Process | ask for a plan first, for several drafts and a choice, for a self-critique pass |
| Form | the shape of the output: prose, list, table, a fixed template |
| Emphasis | which criterion the brief leans on |
| Viewpoint | a person or a school to work in the manner of (the `muse` skill can supply one) |

Run all variants of a generation in parallel, one fresh agent each (the Agent tool, one
message, several calls). Give the agent the brief and nothing else. Include the unchanged
parent as one of the runs, or keep its earlier result, so that there is a baseline.

Default size: **3 variants and 3 generations**, which is about ten agent runs. Tell the user
this before starting, since it costs tokens, and use other numbers if they ask. For a second
opinion from another model, `agento`'s `run_task` can run a variant when it is connected.

## 4. Judge

Judge the results, not the briefs.

- Compare blind where you can: label the results A, B, C and hide which variant made which.
  For anything that matters, hand the judging to a fresh agent that gets the goal, the
  criteria and the labelled results, and never the briefs.
- Compare pairs ("is A better than B on criterion 2, and why") before giving any score.
  Numbers given to one result alone drift.
- Write one line for each variant: what its tweak changed in the result, and if it helped.

One run is noisy. When two variants are close, the difference is probably chance: call it a
tie, and do not build the next generation on it. Run the pair again if the choice matters.

## 5. Breed the next generation

- The winner is the new parent. If nothing beat the parent, keep the parent.
- Keep a tweak that helped. Drop one that did not, and do not try it again.
- Cross: if two variants each won on a different criterion, make one child with both tweaks.
- Take the next tweaks from what the judging showed was still weak, not from the table at
  random.
- Keep the best result so far apart. A later generation can be worse; the best one found is
  what gets delivered, whenever it appeared.

Stop when the generations are used up, when a generation brings no improvement, or when the
user says the result is good. Do not go on because there are tweaks left to try.

## 6. Deliver

Give, in this order:

1. **The best result**, complete, ready to use.
2. **The brief that made it**, so that the user can use it again.
3. **What mattered**: the two or three tweaks that changed the result, and the ones that made
   no difference, each in one line. A small table of generations (variant, tweak, verdict) is
   enough for the rest.

Say plainly if the search found little: "the first brief was already close; the gain is small"
is a useful answer.
