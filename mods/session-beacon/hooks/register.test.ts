import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'session-beacon',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 },
} as const

test('the band lights when another session sends a message, then goes idle', async ($, on) => {
  const clock = mock.clock(on)
  on('session.receive', ($, e) => ({ text: e.text }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface } as never)
    expect(await ui.find({ type: 'Text', text: /idle/ })).toBeDefined()

    await $.session.receive({ origin: { kind: 'peer' }, text: 'hello' })
    expect(
      await ui.find({ type: 'Text', text: /receiving from another session/ }),
    ).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /idle/ })).toBeUndefined()

    await clock.advance(20_000)
    expect(await ui.find({ type: 'Text', text: /idle/ })).toBeDefined()

    await ui.unmount()
  }
})

test('a notification that is not from a session leaves the band idle', async ($, on) => {
  mock.clock(on)
  on('session.receive', ($, e) => ({ text: e.text }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)

  await $.session.receive({ origin: { kind: 'task-notification' }, text: 'done' })
  expect(await ui.find({ type: 'Text', text: /idle/ })).toBeDefined()
})

test('a sent message shows whom it went to', async ($, on) => {
  mock.clock(on)
  on('session.send', () => ({ isDelivered: true as const }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)

  await $.session.send({ to: 'potion-72', text: 'ping', origin: { kind: 'model' } })
  expect(await ui.find({ type: 'Text', text: /sending to potion-72/ })).toBeDefined()
})
