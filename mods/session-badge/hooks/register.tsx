import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Stats } from '../types'

/**
 * Session badge: a small framed row at the right end of the band above the prompt, always on. The session's name in
 * rainbow letters inside a frame whose colour is picked from the name (so two terminals side by side never look alike),
 * then whether it is working, its turns, tool calls, messages received from other sessions, uptime, and a sparkline of
 * the tool calls of the last turns. `/badge` hides it or brings it back.
 */
const RAINBOW = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'] as const
const BARS = '▁▂▃▄▅▆▇█'
const KEEP = 12

const name = atom({ plugin: 'session-badge', key: 'name' } as const, '')
const stats = atom({ plugin: 'session-badge', key: 'stats' } as const, { turns: 0, tools: 0, mail: 0, recent: [] } as Stats)
const startedAt = atom({ plugin: 'session-badge', key: 'startedAt' } as const, 0)
const now = atom({ plugin: 'session-badge', key: 'now' } as const, 0)
const isHidden = atom({ plugin: 'session-badge', key: 'isHidden' } as const, false)

/** Origins that are another session's or agent's message, not the person typing. */
const PEERS = new Set(['peer', 'peer-send-message', 'projects-relay', 'channel'])

/** This session's name and ref, as ListAgents states them ("This session is <name> [<ref>] — …"). */
export function nameFrom(listing: string): string {
  const m = /This session is (.+?)(?: \[[0-9a-f]+\])? — /.exec(listing)
  return m?.[1]?.trim() ?? ''
}

/** The frame's colour: always the same one for a given name. */
export function accentOf(text: string): (typeof RAINBOW)[number] {
  let sum = 0
  for (const ch of text) sum = (sum * 31 + ch.codePointAt(0)!) % 9973
  return RAINBOW[sum % RAINBOW.length]!
}

/** One bar per turn, scaled to the busiest of them. */
export function sparkOf(recent: number[]): string {
  const top = Math.max(1, ...recent)
  return recent.map(n => BARS[Math.min(BARS.length - 1, Math.round((n / top) * (BARS.length - 1)))]).join('')
}

/** `4m`, `1h07`: how long the session has been up. */
export function uptimeOf(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

export const register: Register = on => {
  let toolsThisTurn = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'badge', description: 'Hide or show the session badge above the prompt' })
    const t = await $.clock.now()
    if ((await read($, startedAt)) === 0) await update($, startedAt, () => t)
    await update($, now, () => t)
    // The minute hand: one write a minute redraws the uptime.
    void $.clock.every(60_000, async () => {
      const tick = await $.clock.now()
      await update($, now, () => tick)
    })
    try {
      const { text } = await $.tool.call({ tool: 'ListAgents' })
      const me = nameFrom(String(text ?? ''))
      if (me) await update($, name, () => me)
    } catch {
      // No listing here: the badge says "session".
    }
    return next(e)
  })

  on('command.run', { command: 'badge' }, async $ => {
    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)
    return { text: hidden ? 'Session badge hidden. /badge shows it again.' : 'Session badge shown.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (PEERS.has(e.origin.kind)) await update($, stats, s => ({ ...s, mail: s.mail + 1 }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    toolsThisTurn += 1
    await update($, stats, s => ({ ...s, tools: s.tools + 1 }))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const used = toolsThisTurn
    toolsThisTurn = 0
    await update($, stats, s => ({ ...s, turns: s.turns + 1, recent: [...s.recent, used].slice(-KEEP) }))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const me = (await read($, name)) || 'session'
    const s = await read($, stats)
    const up = uptimeOf((await read($, now)) - (await read($, startedAt)))
    const accent = accentOf(me)
    const isWide = e.props.bodyColumns >= me.length + 62
    return (
      <Box flexDirection="row" justifyContent="flex-end" width={e.props.bodyColumns}>
        <Box flexDirection="row" borderStyle="round" borderColor={accent} paddingX={1} gap={1}>
          <Text color={accent}>◆</Text>
          <Text bold>
            {[...me].map((ch, i) => (
              <Text color={RAINBOW[i % RAINBOW.length]}>{ch}</Text>
            ))}
          </Text>
          {e.props.isWorking ? (
            <Text color="black" backgroundColor="yellow" bold>
              {' ▶ working '}
            </Text>
          ) : (
            <Text color="black" backgroundColor="green" bold>
              {' ■ idle '}
            </Text>
          )}
          {isWide && (
            <Text>
              <Text color="cyan">↻ {s.turns} turns</Text>
              <Text dimColor> · </Text>
              <Text color="magenta">⚒ {s.tools} tools</Text>
              <Text dimColor> · </Text>
              <Text color={s.mail > 0 ? 'yellow' : undefined} bold={s.mail > 0}>
                ✉ {s.mail}
              </Text>
              <Text dimColor> · </Text>
              <Text color="blue">⏱ {up}</Text>
            </Text>
          )}
          {isWide && s.recent.length > 0 && <Text color="green">{sparkOf(s.recent)}</Text>}
        </Box>
      </Box>
    )
  })
}
