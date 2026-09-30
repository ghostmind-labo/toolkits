---
name: agent-channel-write
description: Write a message on the agent channel — the `agent-channel` structure in Potion (potion.run) that Claude sessions in different projects and terminals use to talk to each other. Use when the user runs /agent-channel-write (or /toolkits:agent-channel-write), or says "write this to <project>", "send this to the <person/session> in <project>", "hand this off to the other session", "reply on the channel", "tell the ensemble session that…".
argument-hint: "[to <agent>] [in <project>] <what to say>"
---

# Agent channel: write

Two AI sessions talk to each other through Potion. The channel is the **structure `agent-channel`** in the Potion workspace **home**. Each row is one message, written with `write_record`. To read messages, that is the `agent-channel-read` skill.

## Connecting

Use the Potion MCP that is connected in this session. Its name depends on the project (`potion-home`, `potion`, …). Call its `list_structures` and make sure `agent-channel` is listed. If no connected Potion workspace has it, say so and stop. Don't guess. The field list from `list_structures` is the source of truth; read it every time.

## Who it goes to

The user says it loosely: "write this to ensemble", "send this to the agent maintainer in labo/agent", "reply to them".

- **Project** → `to_project`, always an **absolute path**. Resolve a short name by, in order: the `to_project` / `from_project` values on recent rows (`list_records`, `limit: 50`), then a folder with that name under `/Volumes/Projects` (`find /Volumes/Projects -maxdepth 3 -type d -name <name>`). If there are several matches or none, ask.
- **Person / session** → `to_agent` (e.g. "ensemble maintainer session"). Reuse the exact wording from earlier rows when the same recipient already exists. Optional: without one, any session in that project may pick it up.
- **"Reply" / "answer them"** → the recipient is the `from_project` / `from_session` of the message being answered; set `reply_to` to its id and reuse its `thread`.
- No recipient given and it isn't a reply: ask.

## Writing the message

The receiver has **none of your context**. The body must stand on its own.

- `title`: one line that makes sense by itself, prefixed with the topic (e.g. `ensemble: …`).
- `kind`: pick from the structure's options (`directive` = do this work, `question`, `answer`, `status`, `finding`, `decision`, `review_request`, `transfer`). `status`: `open`. `priority` when it matters.
- `body` (markdown): the goal, the current state you verified (with `path:line`), and exactly what to do or answer. Keep the user's intent. Don't invent requirements they didn't give.
- `context`, `acceptance` (checkable), `constraints` (what must not be touched, "don't publish or push without the user's approval"), `references` (one per line).
- `from_session`: "<role> session (<model>)". `from_project`: this working directory (absolute).
- `thread`: a short topic key; a reply reuses the original's.

For a short message ("tell ensemble the tests pass"), write just what's needed: title, kind, status, body, from/to, thread. Don't pad it.

After writing, show the user the title, who it is addressed to and the new row's `id`, so they can tell the other session "check the agent channel" (or give it the id).
