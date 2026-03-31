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
 * In this repository, WXT injects the Promise-based `browser` API via
 * `wxt/browser`, so entry points do not manually import `webextension-polyfill`.
 * Prefer the shared WXT pattern already documented in `docs/platform.md`.
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
