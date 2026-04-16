/**
 * Firefox platform notes.
 *
 * Background execution
 * --------------------
 * The Firefox manifest uses `"background": { "scripts": ["…"] }` (non-persistent
 * background script). Firefox MV3 also supports `"service_worker"`, but the
 * scripts approach is used here for wider compatibility (Firefox 140+).
 * Like Chrome service workers, avoid in-memory state between event wake cycles.
 *
 * Polyfill
 * --------
 * Firefox 121+ ships a native, Promise-based `browser` global — the polyfill
 * detects this at runtime and re-exports the native object without wrapping.
 * No Promises-to-callbacks conversion is needed.
 *
 * Known limitations / differences from Chrome
 * --------------------------------------------
 * - `browser.identity` is NOT available on Firefox. Use `browser.tabs.create`
 *   for OAuth flows (already the approach in skeeditor).
 * - `browser.sidebarAction` (Firefox-specific) is the sidebar equivalent of
 *   Chrome's `sidePanel`. skeeditor does not currently use either.
 * - `browser.tabs.hide` / `browser.tabs.show` are Firefox-only.
 * - `browser.runtime.getBrowserInfo()` is a Firefox-only API — used by
 *   `detectPlatform()` as the Firefox signal.
 * - `browser_specific_settings.gecko.strict_min_version: "140.0"` is set in the
 *   Firefox desktop manifest, with `gecko_android.strict_min_version: "142.0"`
 *   for Firefox on Android.
 * - Content script isolation is stricter: scripts run in an isolated world and
 *   cannot access page scripts' globals directly (same as Chrome).
 *
 * Development with web-ext
 * ------------------------
 * 1. `pnpm build:firefox`
 * 2. `npx web-ext run --source-dir dist/firefox/ --firefox=nightly`
 */
export const FIREFOX_NOTES = 'firefox' as const;
