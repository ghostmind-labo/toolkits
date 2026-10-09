/** A message another session sent here: who, when (local time), the text. */
export type Delivery = { from: string; at: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'session-inbox': { name: string; inbox: Delivery[] }
  }
}
