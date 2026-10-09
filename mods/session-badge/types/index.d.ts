/** What the badge counts for this session. `recent` is the tool calls of the last turns, oldest first. */
export type Stats = { turns: number; tools: number; mail: number; recent: number[] }

declare module 'claude-code' {
  interface PluginState {
    'session-badge': { name: string; stats: Stats; startedAt: number; now: number; isHidden: boolean }
  }
}
