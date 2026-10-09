import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { bodyOf, nameFrom, senderOf } from './register'

test('a delivery is read from its frame: sender, body; the name from the listing', () => {
  const framed = 'Another Claude session sent a message:\n<agent-message from="potion-21">\n  hello from potion\n</agent-message>'
  expect(senderOf(framed, 'peer')).toBe('potion-21')
  expect(bodyOf(framed)).toBe('hello from potion')
  expect(senderOf('plain text', 'peer')).toBe('peer')
  const peer = 'Another Claude session sent a message:\n<cross-session-message from="uds:/tmp/cc-socks/42621.sock" from-name="system-2b" from-mode="prompting">\nTest message from system-2b: the heron counted 47 purple umbrellas.\n</cross-session-message>'
  expect(senderOf(peer, 'peer')).toBe('system-2b')
  expect(bodyOf(peer)).toBe('Test message from system-2b: the heron counted 47 purple umbrellas.')
  expect(nameFrom('This session is check-transcription-latency [66bcd2] — the name other sessions use to message it')).toBe('check-transcription-latency [66bcd2]')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a peer's message is kept and drawn in the pane; the person's own prompt is not (${surface})`, async ($, on) => {
    on('prompt.submit', async (_, e) => ({ text: e.text }))
    // The engine's own drawing and toast, beneath the plugin: nothing to draw, a toast shown.
    on('ui.render', async ($, e) => { const { Box } = $.ui.resolve(e); return h(Box, null) as RenderElement })
    on('ui.toast', async () => ({ value: undefined }))
    await $.prompt.submit({ text: 'my own words', origin: { kind: 'composer' }, wait: false })
    await $.prompt.submit({ text: '<cross-session-message from="uds:/x.sock" from-name="potion-21">deploy is done</cross-session-message>', origin: { kind: 'peer' }, wait: false })
    const pane = await $.ui.mount({ plugin: 'session-inbox', surface, component: 'Pane', props: { title: 'Session inbox', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} }, requestId: 'session-inbox' })
    expect(await pane.find({ text: /potion-21/ })).toBeTruthy()
    expect(await pane.find({ text: /deploy is done/ })).toBeTruthy()
    expect(await pane.find({ text: /my own words/ })).toBeFalsy()
  })
}
