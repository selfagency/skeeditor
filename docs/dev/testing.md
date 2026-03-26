# Testing

skeeditor has three test layers: unit, integration, and end-to-end. Each targets a different scope and uses a different tool.

---

## Quick reference

```sh
pnpm test               # unit + integration (default CI gate)
pnpm test:unit          # unit only
pnpm test:integration   # integration only
pnpm test:e2e           # Playwright E2E (Chrome + Firefox)
pnpm test:watch         # Vitest in watch mode (unit + integration)
```

For a coverage report:

```sh
pnpm test:coverage   # if the script is configured; otherwise:
vitest run --coverage --project unit --project integration
```

---

## Unit tests (Vitest + jsdom)

**Location:** `test/unit/`
**Runner:** Vitest (`vitest.config.ts`, project `unit`)
**Environment:** `jsdom`

Unit tests cover pure functions, utilities, parsers, and class methods in isolation. No network, no browser extension APIs.

### Browser API mocking

`test/setup/unit.ts` is the Vitest setup file for the `unit` project. It registers stubs for the `chrome.*` / `browser.*` extension APIs via `test/mocks/browser-apis.ts`. This lets content-script and background code import and run without a real browser.

### Import example

```ts
import { describe, test, expect } from "vitest";
import { detectLinks } from "@src/shared/utils/facets";

describe("detectLinks", () => {
  test("returns a facet for a bare URL", () => {
    const text = "check out https://example.com today";

    const results = detectLinks(text);

    expect(results).toHaveLength(1);
    expect(results[0]?.uri).toBe("https://example.com");
  });
});
```

### Naming and structure conventions

- Files: `test/unit/<mirror-of-src-path>.test.ts`
- Suites: `describe('<module name>')` → `test('should <behaviour>')`
- Arrange-Act-Assert with blank-line separation between phases
- One assertion per test where practical; group only tightly related checks

---

## Integration tests (Vitest + MSW)

**Location:** `test/integration/`
**Runner:** Vitest (`vitest.config.ts`, project `integration`)
**Environment:** `node` (not jsdom)

Integration tests verify HTTP request/response flows — primarily XRPC calls to the Bluesky PDS. [MSW (Mock Service Worker)](https://mswjs.io/) intercepts outbound `fetch` at the Node.js level and returns controlled responses.

### MSW setup

`test/mocks/server.ts` creates the MSW server.
`test/mocks/handlers.ts` defines request handlers for every XRPC endpoint used by the extension.
`test/setup/integration.ts` starts the server before all tests and closes it after.

### Example

```ts
import { http, HttpResponse } from "msw";
import { server } from "@test/mocks/server";
import { XrpcClient } from "@src/shared/api/xrpc-client";

test("getRecord returns parsed record", async () => {
  server.use(
    http.get("https://bsky.social/xrpc/com.atproto.repo.getRecord", () =>
      HttpResponse.json({
        uri: "at://...",
        cid: "baf...",
        value: { text: "hello" },
      }),
    ),
  );

  const client = new XrpcClient({
    service: "https://bsky.social",
    accessJwt: "tok",
  });

  const result = await client.getRecord({
    repo: "did:plc:abc",
    collection: "app.bsky.feed.post",
    rkey: "1",
  });

  expect(result.value.text).toBe("hello");
});
```

---

## End-to-end tests (Playwright)

**Location:** `test/e2e/`
**Runner:** Playwright (`playwright.config.ts`)
**Targets:** `chromium-extension` and `firefox-extension` projects

E2E tests load the built extension (from `dist/chrome/` or `dist/firefox/`) into a real browser context and exercise the full UI flow.

### Fixtures

`test/e2e/fixtures/chromium-extension.ts` — a custom Playwright fixture that launches a Chromium browser with the extension loaded via `--load-extension`.

`test/e2e/fixtures/firefox-extension.ts` — launches Firefox with the extension loaded as a temporary add-on.

`test/e2e/fixtures/mock-bsky-page.html` — a static HTML page that mimics the bsky.app post DOM structure, allowing E2E tests to run without a live Bluesky connection.

### Running E2E tests

The extension must be built before running E2E tests:

```sh
pnpm build:chrome && pnpm build:firefox
pnpm test:e2e
```

Run only one browser:

```sh
pnpm test:e2e:chromium
pnpm test:e2e:firefox
```

List all tests without running:

```sh
pnpm test:e2e:list
```

---

## Manual browser testing

Automated tests cover the majority of logic, but manual testing in a real browser is the only way to verify DOM injection, extension popup UI, and browser-specific behaviours. The steps below explain how to build and side-load the extension in each supported browser.

### Prerequisites

| Tool                                                    | Purpose                |
| ------------------------------------------------------- | ---------------------- |
| Node.js 20+ / pnpm 9+                                   | Build toolchain        |
| Chrome 120+                                             | Chrome manual testing  |
| Firefox 125+ (Nightly or Developer Edition recommended) | Firefox manual testing |
| macOS 14+ (Sonoma), Xcode 15+, Safari 17+               | Safari manual testing  |

Install Playwright browsers once if you haven't already (needed for the Xcode helper too):

```sh
pnpm exec playwright install chromium firefox
```

---

### Chrome

#### 1. Build

One-time build:

```sh
pnpm build:chrome
```

Or start a watch build so the extension rebuilds on every file save:

```sh
pnpm build:watch:chrome
```

#### 2. Load unpacked

1. Open **`chrome://extensions`** in your address bar.
2. Toggle **Developer mode** on (top-right corner).
3. Click **Load unpacked**.
4. Select the **`dist/chrome/`** folder.

The extension appears in the list. Pin it to the toolbar via the puzzle-piece icon if you want quick popup access.

#### 3. Reload after changes

When the watch build writes new files, Chrome does not reload automatically. Either:

- Click the **⟳ refresh** button on the extension card at `chrome://extensions`, or
- Install [Extensions Reloader](https://chromewebstore.google.com/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid) and bind it to a keyboard shortcut.

The content script re-injects on the next page navigation without a manual reload.

#### 4. Debug the background service worker

On the extension card at `chrome://extensions`, click **Service Worker** (shown as a link next to "Inspect views"). This opens a dedicated DevTools window attached to the service worker context, where you can inspect console output, set breakpoints, and examine `chrome.storage`.

#### 5. Debug the content script

Open any `https://bsky.app` tab. Press **F12** (or ⌥⌘I on macOS) to open DevTools, then switch to the **Console** tab. Messages from the content script appear here prefixed with `skeeditor:`. Use the **Sources** panel → **Content scripts** tree to set breakpoints in `content-script.js`.

#### 6. Debug the popup

Right-click the extension icon in the toolbar and choose **Inspect popup**. DevTools opens attached to the popup window.

---

### Firefox

#### 1. Build the Firefox extension

```sh
pnpm build:firefox
```

Or watch mode:

```sh
pnpm build:watch:firefox
```

#### 2a. Load via `about:debugging` (no extra tools)

1. Open **`about:debugging#/runtime/this-firefox`**.
2. Click **Load Temporary Add-on…**.
3. Navigate to `dist/firefox/` and select **`manifest.json`**.

The extension loads as a temporary add-on and appears in the list. Temporary add-ons are removed when Firefox closes.

#### 2b. Load via `web-ext` (recommended for iterative dev)

`web-ext` is included as a dev dependency:

```sh
pnpm exec web-ext run \
  --source-dir dist/firefox/ \
  --firefox=nightly        # or: --firefox=deved
```

`web-ext` launches a clean Firefox profile with the extension pre-loaded and **automatically reloads** the extension whenever files in `dist/firefox/` change, making watch-mode iteration much smoother.

#### 3. Reload after changes (manual path)

At `about:debugging#/runtime/this-firefox`, click **Reload** on the extension row.

#### 4. Debug the background script

At `about:debugging#/runtime/this-firefox`, click **Inspect** on the extension row. A DevTools window opens attached to the background context. The **Console** tab shows background log output; **Sources** lets you set breakpoints.

#### 5. Debug the Firefox content script

Open a `https://bsky.app` tab and open the Browser Toolbox:

- **Tools → Browser Tools → Browser Toolbox** (you may need to enable the setting at **Settings → Advanced settings → Enable browser chrome and add-on debugging toolboxes** first).

Alternatively, open the regular DevTools (**F12**) — content script logs appear in the **Console** under the page origin.

#### 6. Debug the Firefox popup

Click the extension icon to open the popup, then right-click inside the popup and choose **Inspect Element**. A DevTools panel opens attached to the popup document.

---

### Safari (macOS 14+ / Xcode 15+ required)

Safari requires every extension to ship as a **macOS app wrapper**. The build script generates one via `xcrun safari-web-extension-converter`.

#### 1. Build and convert the Safari extension

```sh
pnpm build:safari
```

This runs Vite for the `safari` target and then executes the converter. The Xcode project lands at **`dist/safari-xcode/`**.

If you need to run the converter step manually (e.g. after changing the manifest overlay):

```sh
xcrun safari-web-extension-converter dist/safari \
  --project-location ./dist/safari-xcode \
  --app-name skeeditor \
  --bundle-identifier dev.selfagency.skeeditor \
  --swift \
  --force
```

#### 2. Open and run the Xcode project

```sh
open dist/safari-xcode/skeeditor.xcodeproj
```

In Xcode:

1. Select the **skeeditor** scheme (macOS target, not iOS).
2. Press **⌘R** (or **Product → Run**).

A small macOS app launches — its only purpose is to register the extension with the system. You can quit it immediately after it opens.

#### 3. Allow unsigned extensions in Safari

Safari blocks unsigned extensions by default during development. Enable loading once:

1. **Safari → Settings → Advanced** → check **Show features for web developers**.
2. **Develop → Allow Unsigned Extensions** (this resets every time Safari quits — you must re-enable it each session).

#### 4. Enable the extension

1. **Safari → Settings → Extensions**.
2. Find **skeeditor** in the list and check the checkbox to enable it.
3. Grant access to `bsky.app` when prompted (choose **Allow on Every Website** or **Allow on bsky.app**).

#### 5. Test on bsky.app

Navigate to `https://bsky.app`. The extension should inject its content script. The extension icon appears in the Safari toolbar; click it to open the popup.

#### 6. Debug the content script

1. **Develop → (your Mac name) → bsky.app** — this opens Web Inspector attached to the page, where you can see content-script console output and set breakpoints in **Sources**.

#### 7. Debug the background service worker

In the Develop menu, look for an entry like **Develop → (your Mac name) → skeeditor – Background Page**. If it is not visible, reload the extension in Settings → Extensions (toggle off/on). The Web Inspector attached to the background context allows console inspection and breakpoints.

#### 8. Debug the popup

Click the extension icon to open the popup, then go to **Develop → (your Mac name) → skeeditor – popup.html**. This attaches Web Inspector to the popup document.

#### 9. Rebuilding

After any source change:

1. Run `pnpm build:safari` again (the converter adds `--force` to overwrite).
2. In Safari Settings → Extensions, toggle the extension off and on to reload it.

You do **not** need to re-run the Xcode app unless the app wrapper itself has changed.

---

### Smoke-test checklist

Run through this on each browser before opening a PR:

- [ ] Extension loads without error (no red badges or warnings in the extension manager)
- [ ] Log in via the popup (`http://bsky.app` must be open first)
- [ ] Navigate to a post you authored — an **Edit** button appears in the post actions
- [ ] Other users' posts have no Edit button
- [ ] Clicking Edit opens the modal pre-populated with the post text
- [ ] Saving an edit closes the modal and shows the success indicator
- [ ] Triggering a conflict (open the same post in two tabs, save from one, then save a different edit from the other) shows the conflict prompt

---

## Coverage targets

| Package           | Target              |
| ----------------- | ------------------- |
| `src/shared/`     | ≥ 90% line coverage |
| `src/content/`    | ≥ 80% line coverage |
| `src/background/` | ≥ 80% line coverage |

Coverage is enforced in CI. A PR that reduces coverage below threshold will fail.

---

## Adding new tests

1. **New utility function** → add a unit test in `test/unit/` first (TDD: write failing test, then implement).
2. **New XRPC endpoint usage** → add an MSW handler in `test/mocks/handlers.ts`, then write an integration test.
3. **New DOM interaction** → unit test the logic, add an E2E test for the browser interaction.
4. **Bug fix** → write a test that reproduces the bug before fixing it.

See [Contributing](./contributing) for the TDD workflow requirements.
