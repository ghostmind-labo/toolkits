import { expect, test } from 'claude-code/testing'

import { nameIn } from './register'

const MINE = JSON.stringify({ pid: 2, sessionId: 'mine', name: 'toolkits-32' })
const OTHER = JSON.stringify({ pid: 1, sessionId: 'other', name: 'noice-70' })

test('the name is the one in this session\'s own registry record', () => {
  expect(nameIn([OTHER, MINE], 'mine')).toBe('toolkits-32')
  expect(nameIn([OTHER, '{"half'], 'mine')).toBe('')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band shows the session's name once the registry has it (${surface})`, async ($, on) => {
    on('session.id', () => ({ value: 'mine' }))
    on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
    on('fs.list', () => ({
      value: ['1.json', '2.json', '2.key'].map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })),
    }))
    on('fs.read', (_, e) => ({ value: e.path === '/home/me/.claude/sessions/2.json' ? MINE : OTHER }))
    on('prompt.submit', async (_, e) => ({ text: e.text }))

    await $.prompt.submit({ text: 'hi', wait: false })
    const band = await $.ui.mount({
      plugin: 'session-name',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 },
    } as never)
    expect(await band.find({ text: /toolkits-32/ })).toBeTruthy()
    expect(await band.find({ text: /noice-70/ })).toBeUndefined()
  })
}
