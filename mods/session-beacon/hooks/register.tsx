import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Link, Totals } from '../types'

const name = atom({ plugin: 'session-beacon', key: 'name' } as const, null)
const link = atom({ plugin: 'session-beacon', key: 'link' } as const, null)
const totals = atom({ plugin: 'session-beacon', key: 'totals' } as const, {
  received: 0,
  sent: 0,
})

// How long a link stays lit when nothing ends it sooner.
const RECEIVE_MS = 20_000
const SEND_MS = 8_000

// Deliveries that come from another session, as `session.receive` classifies them.
const PEER_KINDS = ['peer', 'coordinator', 'peer-send-message', 'projects-relay']

// The engine keeps one registry file per running session, holding the name
// other sessions message it by (what ListAgents shows).
async function findName($: EngineInterface): Promise<string | null> {
  const home = await $.env.get('HOME')
  const id = await $.session.id()

  if (home === undefined) {
    return null
  }

  const folder = `${home}/.claude/sessions`

  for (const entry of await $.fs.list(folder)) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) {
      continue
    }

    try {
      const record = JSON.parse(await $.fs.read(`${folder}/${entry.name}`))

      if (record.sessionId === id && typeof record.name === 'string') {
        return record.name
      }
    } catch {
      // A file mid-write or not a session record: skip it.
    }
  }

  return null
}

// A reload starts this over, which is why `session.start` clears the link.
let timer: Timer | undefined

async function refreshName($: EngineInterface): Promise<void> {
  const found = await findName($).catch(() => null)

  if (found !== null && found !== (await read($, name))) {
    await update($, name, () => found)
  }
}

async function light(
  $: EngineInterface,
  next: Omit<Link, 'at'>,
  ms: number,
): Promise<void> {
  const at = await $.clock.now()
  const lit: Link = { ...next, at }

  await update($, link, () => lit)
  await update($, totals, (t: Totals | undefined) => {
    const { received, sent } = t ?? { received: 0, sent: 0 }

    return next.direction === 'in'
      ? { received: received + 1, sent }
      : { received, sent: sent + 1 }
  })

  timer?.cancel()
  timer = $.clock.after(ms, () => {
    void update($, link, current => (current?.at === at ? null : (current ?? null)))
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A reload drops the timer that would have cleared a lit link.
    await update($, link, () => null)
    await refreshName($)

    return next(e)
  })

  on('session.receive', async ($, e, next) => {
    const result = await next(e)
    const isQueued = result.consumed === undefined
    const isMain = e.agentId === undefined

    if (isQueued && isMain && PEER_KINDS.includes(e.origin.kind)) {
      const peer = 'teammate' in e.origin ? e.origin.teammate : 'another session'
      await light($, { direction: 'in', peer }, RECEIVE_MS)
    }

    return result
  })

  on('session.send', async ($, e, next) => {
    const result = await next(e)

    if (result.isDelivered && e.agentId === undefined) {
      await light($, { direction: 'out', peer: e.to }, SEND_MS)
    }

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const current = await read($, link)

    // The turn that read an incoming message is over: the exchange is done.
    if (current?.direction === 'in' && (await $.clock.now()) - current.at > 1_500) {
      await update($, link, () => null)
    }

    // The engine may rename a session once it knows what the work is about.
    await refreshName($)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const label = (await read($, name)) ?? 'unnamed session'
    const current = await read($, link)
    const { received, sent } = await read($, totals)

    return (
      <Box>
        <Text key="name" backgroundColor="claude" color="inverseText" bold>
          {' '}◆ {label}{' '}
        </Text>
        <Text> </Text>
        {current === null ? (
          <Text key="status" dimColor>
            ○ idle
          </Text>
        ) : current.direction === 'in' ? (
          <Text key="status" backgroundColor="success" color="inverseText" bold>
            {' '}⇣ receiving from {current.peer}{' '}
          </Text>
        ) : (
          <Text key="status" backgroundColor="suggestion" color="inverseText" bold>
            {' '}⇡ sending to {current.peer}{' '}
          </Text>
        )}
        <Text> </Text>
        <Text key="received" color="success">
          ⇣{received}
        </Text>
        <Text> </Text>
        <Text key="sent" color="suggestion">
          ⇡{sent}
        </Text>
      </Box>
    )
  })
}
