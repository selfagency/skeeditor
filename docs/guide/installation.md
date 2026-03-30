# Installation

## Chrome

### Chrome Web Store

1. Visit the [Chrome Web Store listing](https://chrome.google.com/webstore) _(coming soon)_.
2. Click **Add to Chrome**.
3. Click **Add extension** in the confirmation dialog.
4. The Skeeditor icon appears in your toolbar. Pin it for easy access.

### Load manually (developer / release ZIP)

1. Download the latest `skeeditor-chrome-<version>.zip` from [GitHub Releases](https://github.com/selfagency/skeeditor/releases).
2. Unzip to a folder you won't move (e.g. `~/Extensions/skeeditor`).
3. In Chrome, open `chrome://extensions`.
4. Enable **Developer mode** (toggle, top-right).
5. Click **Load unpacked** and select the unzipped folder.
6. The extension is now active.

---

## Firefox

### Firefox Add-ons (AMO)

1. Visit the [Firefox Add-ons listing](https://addons.mozilla.org) _(coming soon)_.
2. Click **Add to Firefox**.
3. Click **Add** in the permissions dialog.

### Load manually (developer)

Unsigned extensions require Firefox Nightly, Developer Edition, or a configuration change on ESR.

1. Download the latest `skeeditor-firefox-<version>.zip` from [GitHub Releases](https://github.com/selfagency/skeeditor/releases).
2. Rename the file to have a `.xpi` extension.
3. In Firefox, open `about:addons`.
4. Click the gear icon → **Install Add-on From File…**.
5. Select the `.xpi` file.

Alternatively, for development:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select the `manifest.json` inside the unzipped folder.

---

## Safari (macOS) — Coming soon

Safari support is under active development. Safari extensions are distributed as macOS apps, so the release process is a bit different. Check back soon!

::: info Developer builds
If you're building Skeeditor from source, you can generate a Safari build with `task build:safari:swift`. See the [Cross-Browser Platform](../dev/platform) docs for development instructions.
:::

---

## Permissions

When you install Skeeditor, your browser will ask for these permissions:

- `storage` — stores OAuth sessions, settings, and short-lived prompt/state flags in extension storage
- `activeTab` — reads the active tab URL to know when you are on `bsky.app`
- `tabs` — opens and manages auth callback/sign-in tabs during OAuth flow
- `alarms` — schedules service-worker keepalive/retry timers in MV3 background context
- `https://bsky.app/*` — injects the edit UI into bsky.app pages and intercepts post navigation
- `https://*.bsky.network/*` — makes authenticated PDS calls to fetch/save records
- `https://docs.skeeditor.link/*` — loads OAuth client metadata and callback host pages
- `https://slingshot.microcosm.blue/*` — reads public record snapshots for edited-post refresh acceleration

Skeeditor requests no analytics, history, bookmark, or broad `<all_urls>` permissions.
