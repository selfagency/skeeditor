// Minimal stubs for wxt/utils/* modules used by entrypoints.
// These modules are only resolvable inside WXT's build pipeline; Vitest needs
// the aliases in vitest.config.ts to point here instead.

export function defineBackground(arg: (() => void) | { main: () => void }): { main: () => void } {
  if (arg === null || arg === undefined || typeof arg === 'function') return { main: arg as () => void };
  return arg as { main: () => void };
}

export function defineContentScript(arg: unknown): unknown {
  return arg;
}
