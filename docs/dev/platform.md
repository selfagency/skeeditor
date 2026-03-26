# Cross-Browser Platform

skeeditor targets Chrome, Firefox, and Safari using a shared `src/` codebase. Browser-specific differences are isolated in `src/platform/<browser>/` shims and per-browser manifest overlays.

---

## Build targets

| Browser | Build command        | Output directory |
| ------- | -------------------- | ---------------- |
| Chrome  | `pnpm build:chrome`  | `dist/chrome/`   |
| Firefox | `pnpm build:firefox` | `dist/firefox/`  |
| Safari  | `pnpm build:safari`  | `dist/safari/`   |

`pnpm build` is an alias for `pnpm build:chrome`.

---

## Browser API polyfill

`webextension-polyfill` normalises Chromium's callback-based `chrome.*` API into the same Promise-based `browser.*` surface used natively by Firefox and Safari. It is loaded differently depending on the context:

- **Background service worker** — imported as the first statement in `src/background/service-worker.ts` (`import 'webextension-polyfill'`).
- **Content script** — loaded as a separate script via the manifest's `content_scripts.js` array (`browser-polyfill.js` before `content-script.js`). The content script is built as an IIFE that references the global `browser` object.
- **Popup and options pages** — use `browser.runtime.sendMessage` via the typed `sendMessage` wrapper; the polyfill is available from the extension runtime context.

In unit/integration tests, `webextension-polyfill` is stubbed — the `browser.*` global is provided by `test/mocks/browser-apis.ts` via `test/setup/unit.ts` instead.

---

## Platform detection (`src/platform/detect.ts`)

Use **feature detection**, never `navigator.userAgent`. The `detectPlatform()` function uses API presence as the signal:

| Signal                                         | Browser |
| ---------------------------------------------- | ------- |
| `browser.runtime.getBrowserInfo` is a function | Firefox |
| `globalThis.safari?.extension` is defined      | Safari  |
| Neither                                        | Chrome  |

```ts
import { platform } from '@src/platform';

if (platform.isFirefox) {
  // Firefox-specific path
}
```

---

## Known API differences

### Background execution model

| Browser | Manifest key            | Notes                                           |
| ------- | ----------------------- | ----------------------------------------------- |
| Chrome  | `"service_worker": "…"` | Non-persistent, wakes on events                 |
| Firefox | `"scripts": ["…"]`      | Non-persistent background script (Firefox 125+) |
| Safari  | `"service_worker": "…"` | Non-persistent, mirrors Chrome                  |

**Never store in-memory state between background wake cycles.** Use `browser.storage.local` for any data that must survive the background being unloaded.

### `browser.identity`

Not available on Firefox or Safari. skeeditor uses `browser.tabs.create` for the OAuth redirect tab — this works cross-browser.

### Side panel / sidebar

- Chrome 114+: `browser.sidePanel` (not currently used by skeeditor)
- Firefox: `browser.sidebarAction` (different API, Firefox-only)
- Safari: no equivalent

### `webRequest` blocking mode

Replaced by `declarativeNetRequest` in Manifest V3 on Chrome and Safari. Firefox MV3 still supports `webRequest` blocking, but skeeditor does not use either API.

### Safari limitations

- Minimum version: macOS 14+ (Sonoma), Safari 17+
- The extension must ship as a macOS app wrapper (Xcode project). The `build:safari` script handles this via `xcrun safari-web-extension-converter`.
- Check [Apple's Safari release notes](https://developer.apple.com/documentation/safari-release-notes) before using any new WebExtension API.

---

## Manifest structure

```text
manifests/
├── base.json              ← shared: permissions, host_permissions, content_scripts, action
├── chrome/manifest.json   ← adds: "background": { "service_worker": "..." }
├── firefox/manifest.json  ← adds: "background": { "scripts": [...] }, gecko settings
└── safari/manifest.json   ← adds: "background": { "service_worker": "..." }
```

At build time, `scripts/merge-manifest.ts` merges `base.json` with the browser overlay and writes the result to `dist/<browser>/manifest.json`.

---

## Dev workflow

### Chrome

```sh
pnpm build:watch:chrome
# In Chrome: chrome://extensions → Developer mode → Load unpacked → dist/chrome/
```

### Firefox

```sh
pnpm build:watch:firefox
# Then either:
web-ext run --source-dir dist/firefox/ --firefox=nightly
# Or: about:debugging → Load Temporary Add-on → dist/firefox/manifest.json
```

### Safari

```sh
pnpm build:safari
xcrun safari-web-extension-converter dist/safari \
  --project-location ./safari-xcode \
  --app-name skeeditor \
  --bundle-identifier dev.selfagency.skeeditor \
  --swift
# Open the Xcode project, build, and enable in Safari → Settings → Extensions
```

To allow unsigned extensions during development: Safari → Settings → Advanced → Show features for web developers → Developer → Allow unsigned extensions.

---

## Minimum supported versions

| Browser | Minimum version      | Key requirement                       |
| ------- | -------------------- | ------------------------------------- |
| Chrome  | 120                  | MV3 service worker stability          |
| Firefox | 121                  | MV3 non-persistent background support |
| Safari  | 17 (macOS 14/Sonoma) | Baseline WebExtensions MV3            |
