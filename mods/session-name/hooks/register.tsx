import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

/**
 * Session name: one row above the prompt, always on, with the name other sessions message this one by (what
 * ListAgents and SendMessage use). Read from the session registry, and read again as the session goes on, since the
 * registry is written a moment after start and a /rename changes the name.
 */
const name = atom({ plugin: 'session-name', key: 'name' } as const, '')

const RECHECK_MS = 30_000

/** The name in the registry record of the session with this id, or '' when no record is its own. */
export function nameIn(records: readonly string[], id: string): string {
  for (const text of records) {
    try {
      const record = JSON.parse(text)
      if (record?.sessionId === id && typeof record.name === 'string') return record.name
    } catch {
      // A record half written: the next check reads it whole.
    }
  }
  return ''
}

async function refresh($: EngineInterface): Promise<void> {
  try {
    const id = await $.session.id()
    const root = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await $.env.get('HOME')}/.claude`
    const folder = `${root}/sessions`
    const records: string[] = []
    for (const entry of await $.fs.list(folder)) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
      try {
        records.push(String(await $.fs.read(`${folder}/${entry.name}`)))
      } catch {
        // A session that just ended took its record with it.
      }
    }
    const found = nameIn(records, id)
    if (found && found !== (await read($, name))) await update($, name, () => found)
  } catch {
    // No registry here: the row stays as it was.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    void refresh($)
    void $.clock.every(RECHECK_MS, () => void refresh($))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const me = await read($, name)
    if (e.props.hasSurvey || me === '') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>session </Text>
        <Text bold color="cyan">
          {me}
        </Text>
      </Box>
    )
  })
}
