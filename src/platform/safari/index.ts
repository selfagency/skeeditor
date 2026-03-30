/**
 * Safari platform notes.
 *
 * Background execution
 * --------------------
 * Safari MV3 uses a service worker (`"background": { "service_worker": "…" }`)
 * mirroring Chrome. Non-persistent; same caveats about in-memory state apply.
 *
 * Polyfill
 * --------
 * Safari 15.4+ exposes `browser.*` natively (via the Web Extension JS bridge).
 * `webextension-polyfill` handles Safari similarly to Firefox — it detects the
 * native `browser` global and re-exports it.
 *
 * Xcode wrapper
 * -------------
 * Safari extensions must be packaged inside a macOS (and optionally iOS) app.
 * Conversion from the Chrome/Firefox build:
 * ```
 * xcrun safari-web-extension-converter dist/safari \
 *   --project-location ./xcode \
 *   --app-name skeeditor \
 *   --bundle-identifier agency.self.skeeditor \
 *   --swift
 * ```
 * Then open the generated Xcode project, build, and enable unsigned extensions:
 * Safari → Settings → Advanced → Show features for web developers →
 * Developer → Allow unsigned extensions.
 *
 * Known limitations / differences from Chrome and Firefox
 * --------------------------------------------------------
 * - Some WebExtension APIs have limited or no support — always check
 *   Apple's compatibility tables before using a new API.
 * - `browser.identity` is NOT available on Safari. Use `browser.tabs.create`.
 * - `webRequest` blocking is not supported in MV3 on Safari; use
 *   `declarativeNetRequest` instead (same as Chrome).
 * - `browser.sidePanel` is not available on Safari.
 * - `globalThis.safari.extension` is the detection signal used by
 *   `detectPlatform()` to identify Safari.
 *
 * Development
 * -----------
 * Run `pnpm build:safari`, then convert and open in Xcode as described above.
 * CI verifies only that the xcrun converter succeeds; full E2E is manual.
 */
export const SAFARI_NOTES = 'safari' as const;
