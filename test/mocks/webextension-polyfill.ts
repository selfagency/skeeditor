// Stub for webextension-polyfill in test environments.
// In real extension contexts the polyfill sets up globalThis.browser.
// In tests, globalThis.browser is provided by test/mocks/browser-apis.ts, so the
// polyfill should be a no-op to avoid its "only load in an extension" guard.
export default {};
