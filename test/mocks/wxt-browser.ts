// In test environments, wxt/browser is aliased to this stub.
// The real wxt/browser throws when loaded outside a browser extension context.
// Tests provide globalThis.browser via test/mocks/browser-apis.ts instead.
export const browser = new Proxy({} as typeof globalThis.browser, {
  get(_target, prop, _receiver) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis.browser as any)[prop];
  },
});

// Re-export Browser namespace type (only used for type assertions in tests).
export type { Browser } from 'wxt/browser';
