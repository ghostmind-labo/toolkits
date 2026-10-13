---
description: Say a short, pleasant summary of this session out loud, in the voice of the spoken-summary hook
argument-hint: "[what the recap should focus on]"
allowed-tools: Bash(bash:*), Bash(tail:*)
---

# Recap — A Spoken Summary of the Session

A long session ends with a lot on screen and little in mind. This command says where things
stand, out loud, in the time it takes to stand up: what now works, then what is still open.
It speaks through `hooks/speak.sh`, so the voice is the one chosen with `voice <name>`.

Focus, if the user gave one: **$ARGUMENTS**

## Step 1: Write the recap

Write it for the ear, not the page:

- 80 to 120 words, warm and plain, in full sentences.
- No lists, no markdown, no file names, no code, no URLs, no version numbers.
- First what now works, then what is still open or waiting on the user.
- Never say something is done, shipped or tested when it is not. If it was only tested in
  part, say which part.
- With a focus given, cover only that.

## Step 2: Speak it

Remove any double quotes from the text, then:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/speak.sh" say "<the recap>"
```

The command returns once the audio has started or failed; it prints nothing on success.

## Step 3: Reply

Print the recap as the whole reply, and nothing else.

If the command failed, say so in one line and show why:

```bash
tail -5 ~/.claude/speak/speak.log
```
