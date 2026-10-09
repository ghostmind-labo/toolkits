export type Link = {
  /** `in`: a message arrived from another session; `out`: this one sent one. */
  direction: 'in' | 'out'
  /** Who is on the other end, as far as the engine says. */
  peer: string
  /** When it happened, in `$.clock.now()` milliseconds. */
  at: number
}

export type Totals = { received: number; sent: number }

declare module 'claude-code' {
  interface PluginState {
    'session-beacon': { name: string | null; link: Link | null; totals: Totals }
  }
}
