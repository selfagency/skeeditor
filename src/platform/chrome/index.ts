/**
 * Chrome / Chromium platform notes.
 *
 * Background execution
 * --------------------
 * Chrome MV3 uses a service worker (`"background": { "service_worker": "…" }`).
 * Service workers are non-persistent — they spin down after a short idle period
 * and are woken by events (messages, alarms, network requests).
 * Do NOT store in-memory state between wake cycles; use `browser.storage.local`.
 *
 * Polyfill
 * --------
 * Chrome exposes only the `chrome.*` callback API; no native `browser` global.
 * `webextension-polyfill` wraps `chrome.*` into a Promise-based `browser` global.
 * Import the polyfill as the first statement in every entry point.
 *
 * Known limitations
 * -----------------
 * - `browser.identity.launchWebAuthFlow` is Chrome-only and not wrapped by the
 *   polyfill for Firefox/Safari. skeeditor uses `browser.tabs.create` for OAuth
 *   to stay cross-browser.
 * - `browser.sidePanel` is available from Chrome 114+ but not on Firefox/Safari.
 * - `webRequest` blocking mode is replaced by `declarativeNetRequest` in MV3.
 * - Offscreen documents (`chrome.offscreen`) can perform DOM work in the
 *   background; not available on Firefox or Safari.
 *
 * Load unpacked for development
 * -----------------------------
 * 1. `pnpm build:chrome`
 * 2. Chrome → Extensions → Load unpacked → select `dist/chrome/`
 */
export const CHROME_NOTES = 'chrome' as const;
