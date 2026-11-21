---
name: unit-first
description: >-
  Explain an equation, a formula or a scientific concept (mathematics first, also physics,
  statistics, signal processing, anything with a formula) by starting from its smallest
  working example and climbing one change at a time to the general case, with a live,
  computed picture and a slider at every step, usually as a step-by-step HTML playground.
  Use this skill whenever the user says "help me understand this equation", "explain X
  starting simple", "start from the simplest case", "build it up step by step", "start with
  a 2x2 matrix", "what is the unit example of X", "make me a playground for X", "walk me up
  to the Riemann hypothesis / Fourier transform / Bayes' rule", or asks to understand a
  theorem, a formula or a physical law and see it work. The `understand` skill chooses the
  medium for any explanation; this one fixes the order of the content when the subject is
  a formula.
---

# Unit first

A formula is easier to grasp when it is built in front of you than when it is stated. This
skill makes the explanation start from the smallest case that already shows the idea (the
**unit example**), and then change exactly one thing per step until the general statement
arrives last, already understood.

The user's own words: *"starting with the most simple example, and even maybe extracting the
function into another function just to understand it, and then moving the ladder step by
step, is for me a way to visualize something and to better grasp it."* Their reminder to
themselves: **start with a 2x2 matrix**.

## The method

1. **Find the unit example.** The smallest case that is not trivial: two terms of a series,
   one prime, one arrow, a 2×2 matrix, one particle, one coin flip, one sine wave. Start
   there. Never open with the general statement.
2. **Extract the sub-functions.** When a formula hides a simpler function, pull it out and
   study it alone first: the one term `n⁻ˢ` as a rotating arrow before the sum `ζ(s)`; the
   dot product of one row before the matrix product; one `e^{iωt}` before the Fourier sum.
3. **Climb the ladder.** Each step changes **exactly one thing**: one more term, one more
   dimension, one more parameter, real to complex, finite to infinite, discrete to continuous,
   one object to two. Keep the order strict; a step may only use what an earlier step showed.
   The general case is the last step, or close to it.
4. **Each step shows five things:**
   - the formula at that step, written out;
   - one or two plain sentences (the `understand` skill's STE rules: short, active, one idea);
   - a live picture computed from the real math, never an illustration or a curve drawn by hand;
   - a slider or button for the one thing that changed (and a few buttons that jump to the
     interesting values, such as a zero, an identity, a degenerate case);
   - a result line with the computed numbers, so the reader can check the picture.
5. **End with the full picture**: what the concept is, why it matters, and how the steps
   connect. In the playground this is the last step's sentence plus a short paragraph after it.

### Designing the ladder

Write the ladder as a numbered list of step titles first, each with the one thing it changes,
and check it before writing any code:

- Does step 1 work with numbers you could do in your head?
- Does each step change one thing only? Two sliders that are new in one step usually mean two steps.
- Does any step use something no earlier step showed? Insert the missing step.
- Is there a known value to aim at on the way (π²/6, the first zero at 14.1347, the 2×2 product
  `[[19,22],[43,50]]`)? Put it on a button: it is the moment the reader checks the picture.
- 6 to 12 steps is the usual range. Fewer means the climb is too steep; more means split the
  subject in two playgrounds.

Examples of ladders that work:

| Subject | Unit example | The climb |
|---|---|---|
| Matrix multiplication | one row · one vector | 2×2 · vector → columns as images of axes → A·B as two moves → entries as row·column → order matters → determinant → n×n |
| Riemann hypothesis | `1 + 1/2ˢ` | partial sums → Euler product → one complex term as an arrow → arrows tip to tail → η in the strip → \|ζ\| on a line → Hardy's Z → zero count vs N(T) → ψ(x) from zeros → error envelope |
| Fourier series | one sine wave | amplitude → frequency → two waves added → n terms of a square wave → the coefficients as dot products → Gibbs overshoot |
| Bayes' rule | one test on one person | a population of 100 dots → base rate → false positives → the posterior as a ratio of areas → the formula |
| Harmonic oscillator | one spring, one mass, no friction | the position over time → energy exchange → friction → a driving force → resonance |

## Building the playground

The usual output is one sequential HTML playground: step dots, Back/Next, a formula strip,
the sentence, a canvas, the sliders and buttons, and a live result line.

1. **Write the math as pure functions** first (section 1 of the template), with no drawing.
   Implement it for real: if the reader is shown ζ, the page computes ζ.
2. **Check it outside the page.** Add known values to `CHECKS` (section 2): a textbook value,
   an identity, a symmetry, the general rule agreeing with the unit case. Riemann's checks
   were ζ(2) = π²/6, ζ(−1) = −1/12 and |ζ| ≈ 1e−14 at the first zero.
3. **Copy the template** [assets/playground.html](assets/playground.html). It is a complete,
   working playground for matrix multiplication from 2×2 up, so it doubles as the worked
   example. Replace sections 1, 2 and 4; keep section 5 (the stepper) as it is; extend the
   helpers in section 3 (`axes`, `curve`, `plane`, `gridUnder`, `poly`, `arrow`, `dot`,
   `label`, `matrix`) when the subject needs a new kind of picture. Change the
   `data-ufp="matrix"` id in both places.
4. **Write the steps** as data:
   `{k, t, f, n, c: [[key, label, min, max, step, default]], btn?: [[label, v => {…}]], draw(c, W, H, v) → result html}`.
   `draw` computes everything from `v`, draws it, and returns the result line built from the
   same numbers it drew. Use the colour tokens `C.a`…`C.d`, `C.ink`, `C.mut`, `C.grid`,
   `C.axis` (read from CSS, so light and dark both work), and the same CSS variables in the
   result line's spans so a colour in the text means the same thing as in the picture.
5. **Run the harness**: `node <skill-dir>/scripts/check.mjs <file.html>`. It runs every check,
   then draws every step at its defaults, at each control's min and max, after each button, at
   640 px and 320 px wide, and fails on a throw, an empty result, or NaN / undefined /
   Infinity in the result line. It prints the default result line of each step: read them
   and check the numbers by hand for one or two steps. Fix until it prints `all passed`.
6. **Look at it.** Open the file in a browser, or screenshot it headless
   (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --window-size=760,760 --screenshot=out.png file://…`),
   and read the image for the steps with the most going on. Labels on top of each other and
   a picture that runs off the canvas are the usual faults; the harness does not see them.

Save the file in the scratchpad unless the user named a place, open it, and publish it with
the Artifact tool when one is available.

## When the user wants it in Potion

Usually the user adds "and create a note". The playground goes into the note as one
` ```html ` block, and the `potion` and `potion-blocks` skills own that part: load them and
follow them, they win over this skill where they differ. The template already respects what
those blocks need:

- one `<style>`, one `<div>`, one `<script>` holding one IIFE, nothing external;
- its root found with `document.querySelector('[data-ufp="…"]')`, not `currentScript`;
- the canvas in a fixed-height wrapper, redrawn by a `ResizeObserver`;
- colours from CSS variables with a `prefers-color-scheme` dark set.

Add what potion-blocks asks for on top: a feed section (`<template data-potion-feed>`, a
static picture of step 1) since the playground is interactive, and its theme rules if they
name variables of their own. Put the full-picture paragraph and the step list as markdown
around the block, so the note reads well without running it.

## Other media

The ladder is the content; the medium can change. For a narrated video (the `understand`
skill, rung 4), each step becomes one or more beats in the same order. For a short answer in
the terminal, write the steps as a numbered list with the formula and the computed values of
each, starting from the unit example, and offer the playground.

## Relation to `understand`

`understand` chooses the medium (STE prose, diagram, HTML page, video) for any explanation.
`unit-first` fixes the order and the shape of the content when the subject is a formula or a
scientific concept, and its usual medium is `understand`'s rung 3, an HTML page. When both
could apply, use this one for the content and `understand`'s rules for the writing.
