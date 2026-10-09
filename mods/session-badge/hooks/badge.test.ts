import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { accentOf, nameFrom, sparkOf, uptimeOf } from './register'

test('the name, its colour, the sparkline and the uptime are read as the badge shows them', () => {
  expect(nameFrom('This session is system-2b [d74d19] — the name other sessions use to message it')).toBe('system-2b')
  expect(nameFrom('nothing here')).toBe('')
  expect(accentOf('system-2b')).toBe(accentOf('system-2b'))
  expect(sparkOf([0, 4, 8])).toBe('▁▅█')
  expect(uptimeOf(4 * 60_000)).toBe('4m')
  expect(uptimeOf(67 * 60_000)).toBe('1h07')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band shows the badge, counts a peer's message and says when the session is working (${surface})`, async ($, on) => {
    on('prompt.submit', async (_, e) => ({ text: e.text }))
    on('ui.render', async ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, null) as RenderElement })
    const props = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} }
    await $.prompt.submit({ text: '<cross-session-message from="uds:/x.sock" from-name="potion-21">hi</cross-session-message>', origin: { kind: 'peer' }, wait: false })
    const band = await $.ui.mount({ plugin: 'session-badge', surface, component: 'AbovePrompt', props })
    expect(await band.find({ text: /idle/ })).toBeTruthy()
    expect(await band.find({ text: /✉ 1/ })).toBeTruthy()
    const busy = await $.ui.mount({ plugin: 'session-badge', surface, component: 'AbovePrompt', props: { ...props, isWorking: true } })
    expect(await busy.find({ text: /working/ })).toBeTruthy()
  })
}
