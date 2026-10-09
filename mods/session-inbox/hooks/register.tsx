import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Delivery } from '../types'

/**
 * Session inbox: a pane that stays open, with this session's name on top (the address another session uses with
 * SendMessage) and, below it, the messages other sessions sent here, newest last. Opened when the session starts and
 * kept; `/inbox` opens it again at any width.
 */
const PANE = 'session-inbox'
const KEEP = 50

const name = atom({ plugin: 'session-inbox', key: 'name' } as const, '')
const inbox = atom({ plugin: 'session-inbox', key: 'inbox' } as const, [] as Delivery[])

/** Origins that are another session's or agent's message, not the person typing. */
const PEERS = new Set(['peer', 'peer-send-message', 'projects-relay', 'channel'])

/**
 * The sender named in a delivery's frame: a peer session's `<cross-session-message from="uds:…" from-name="system-2b">`
 * (its name first, its address otherwise), or a subagent's `<agent-message from="…">`; else the origin kind.
 */
export function senderOf(text: string, fallback: string): string {
  const named = /<cross-session-message[^>]*\bfrom-name="([^"]+)"/.exec(text)
  if (named) return named[1]!
  const peer = /<cross-session-message[^>]*\bfrom="([^"]+)"/.exec(text)
  if (peer) return peer[1]!
  const agent = /<agent-message[^>]*\bfrom="([^"]+)"/.exec(text)
  return agent?.[1] ?? fallback
}

/** The body of a delivery: what is inside its frame (either kind), else the text as it came. */
export function bodyOf(text: string): string {
  const m = /<(cross-session-message|agent-message)[^>]*>([\s\S]*?)<\/\1>/.exec(text)
  const body = (m?.[2] ?? text).trim()
  return body.replace(/\s+/g, ' ').slice(0, 400)
}

/** This session's name, as ListAgents states it ("This session is <name> [<ref>] — …"). */
export function nameFrom(listing: string): string {
  const m = /This session is (.+?) — /.exec(listing)
  return m?.[1]?.trim() ?? ''
}

const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'inbox', description: 'Show this session’s name and the messages other sessions sent it' })
    // Who am I: the engine's own listing says it; kept for the pane.
    try {
      const { text } = await $.tool.call({ tool: 'ListAgents' })
      const me = nameFrom(String(text ?? ''))
      if (me) await update($, name, () => me)
    } catch {
      // No listing (no peers feature): the pane says so.
    }
    void $.ui.open({ id: PANE, title: 'Session inbox' })
    return next(e)
  })

  on('command.run', { command: 'inbox' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Session inbox' })
    return { text: 'Session inbox opened.' }
  })

  // A message from another session arrives as a prompt whose origin is a peer's: keep it, say so, let it through.
  on('prompt.submit', async ($, e, next) => {
    if (PEERS.has(e.origin.kind)) {
      const delivery: Delivery = { from: senderOf(e.text, e.origin.kind), at: stamp(), text: bodyOf(e.text) }
      await update($, inbox, list => [...list, delivery].slice(-KEEP))
      void $.ui.toast(`Message from ${delivery.from}`)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const me = await read($, name)
    const list = await read($, inbox)
    const rows = Math.max(1, (e.viewport?.rows ?? 24) - 6)
    return (
      <Box flexDirection="column">
        <Text bold>{me ? `Session: ${me}` : 'Session: (name unknown — no ListAgents here)'}</Text>
        <Text dimColor>Other sessions reach it with SendMessage to that name.</Text>
        <Text> </Text>
        {list.length === 0 && <Text dimColor>No messages from other sessions yet.</Text>}
        {list.slice(-Math.floor(rows / 2)).map(d => (
          <Box flexDirection="column">
            <Text>
              <Text bold>{d.from}</Text>
              <Text dimColor>  {d.at}</Text>
            </Text>
            <Text>{d.text}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
