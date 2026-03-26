// Stub for webextension-polyfill in test environments.
// In real extension contexts the polyfill wraps the Chrome API and exports the
// wrapped `browser` namespace.  Source files import the default export to get it.
// In tests, globalThis.browser is provided by test/mocks/browser-apis.ts.
// This proxy forwards property access to globalThis.browser so that
// `import browser from 'webextension-polyfill'` works seamlessly in tests.
export default new Proxy({} as typeof globalThis.browser, {
  get(_target, prop, receiver) {
    const b = globalThis.browser;
    if (b == null) return undefined;
    const value = Reflect.get(b, prop, receiver);
    return typeof value === 'function' ? value.bind(b) : value;
  },
});
