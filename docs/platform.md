# Platform Guide

Cross-browser compatibility for skeeditor — Chrome, Firefox, and Safari.

## Overview

skeeditor targets three browser families via Manifest V3. All share a common
`src/` codebase and differ only in manifest overlays and per-browser build output.
The `webextension-polyfill` package normalises the callback-based `chrome.*` API
on Chromium browsers into the same Promise-based `browser.*` surface used natively
by Firefox and Safari.

## Build Targets

| Browser | Build command | Output directory |
| :------ | :------------ | :--------------- |
| Chrome | `pnpm build:chrome` | `dist/chrome/` |
| Firefox | `pnpm build:firefox` | `dist/firefox/` |
| Safari | `pnpm build:safari` | `dist/safari/` |

The default `pnpm build` alias targets Chrome.

Each build writes a merged manifest to `dist/<browser>/manifest.json` by
combining `manifests/base.json` with the per-browser overlay at
`manifests/<browser>/manifest.json`.

## Dev Workflow

### Chrome

1. `pnpm build:chrome` (or `pnpm dev` for watch mode)
2. Open `chrome://extensions/`, enable **Developer mode**
3. **Load unpacked** → select `dist/chrome/`
4. After code changes, click the reload icon in the Extensions page

### Firefox

1. `pnpm build:firefox`
2. `npx web-ext run --source-dir dist/firefox/ --firefox=nightly`
   - `web-ext` automatically reloads the extension on file changes when combined
     with `pnpm build:watch`
3. Or: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
   select `dist/firefox/manifest.json`

### Safari

1. `pnpm build:safari`
2. Convert the output to a native Safari extension:

   ```sh
   xcrun safari-web-extension-converter dist/safari \
     --project-location ./safari-xcode \
     --app-name skeeditor \
     --bundle-identifier dev.selfagency.skeeditor \
     --swift
   ```

3. Open the generated Xcode project, select the macOS target, and build (`⌘B`)
4. Enable unsigned extensions:
   **Safari → Settings → Advanced → Show features for web developers →
   Developer → Allow unsigned extensions**
5. Activate the extension in **Safari → Settings → Extensions**

CI verifies that `xcrun safari-web-extension-converter` succeeds; full E2E
testing on Safari is manual.

## Polyfill Strategy

`webextension-polyfill` is imported as the **first statement** in every Vite
entry point (`service-worker.ts`, `content-script.ts`, `popup.ts`,
`options.ts`). This ensures `globalThis.browser` is available before any
extension code runs.

In test environments (Vitest), `webextension-polyfill` is aliased to a no-op
stub (`test/mocks/webextension-polyfill.ts`). The `browser` global is provided
instead by `test/mocks/browser-apis.ts` via `test/setup/unit.ts`.

## Platform Detection

`src/platform/detect.ts` exports `detectPlatform()`, which uses **feature
detection** to identify the current browser — never `navigator.userAgent`.

| Signal | Browser |
| :----- | :------ |
| `browser.runtime.getBrowserInfo` is a function | Firefox |
| `globalThis.safari.extension` is defined | Safari |
| Neither of the above | Chrome |

Example:

```ts
import { platform } from '@src/platform';

if (platform.isFirefox) {
  // Firefox-specific path
}
```

## Known API Differences

### Background execution model

| Browser | Manifest key | Notes |
| :------ | :----------- | :---- |
| Chrome | `"service_worker": "…"` | Non-persistent, MV3 only |
| Firefox | `"scripts": ["…"]` | Non-persistent background script (Firefox 121+) |
| Safari | `"service_worker": "…"` | Non-persistent, mirrors Chrome |

**Do not store in-memory state between wake cycles.** Use `browser.storage.local`
for any data that must survive the background being unloaded.

### `browser.identity`

Not available on Firefox or Safari. skeeditor uses `browser.tabs.create` for
the OAuth redirect flow — this works cross-browser.

### Side panel / sidebar

- Chrome 114+: `browser.sidePanel` (not currently used by skeeditor)
- Firefox: `browser.sidebarAction` (Firefox-specific, different API)
- Safari: no equivalent

### `webRequest` blocking mode

Replaced by `declarativeNetRequest` in MV3 on Chrome and Safari.
Firefox MV3 still supports `webRequest` blocking, but skeeditor does not use
either API.

### Firefox-only APIs

- `browser.runtime.getBrowserInfo()` — returns Firefox version info
- `browser.tabs.hide()` / `browser.tabs.show()`
- `browser.sidebarAction`

### Safari limitations

- Limited WebExtension API surface; check Apple's compatibility tables
  before using any new API:
  <https://developer.apple.com/documentation/safari-release-notes>
- Minimum Safari version: 15.4 (Web Extensions in macOS 12.3+)

## Manifest Structure

```text
manifests/
  base.json              ← common permissions, content_scripts, action, …
  chrome/manifest.json   ← adds "background": { "service_worker": "…" }
  firefox/manifest.json  ← adds "background": { "scripts": […] } + gecko settings
  safari/manifest.json   ← adds "background": { "service_worker": "…" }
```

The build script (`scripts/build.ts`) merges base + overlay at build time and
writes the result to `dist/<browser>/manifest.json`.
