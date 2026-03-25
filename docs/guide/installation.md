# Installation

## Chrome

### Chrome Web Store

1. Visit the [Chrome Web Store listing](https://chrome.google.com/webstore) *(coming soon)*.
2. Click **Add to Chrome**.
3. Click **Add extension** in the confirmation dialog.
4. The skeeditor icon appears in your toolbar. Pin it for easy access.

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

1. Visit the [Firefox Add-ons listing](https://addons.mozilla.org) *(coming soon)*.
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

## Safari (macOS)

Safari extensions are distributed as macOS apps.

1. Download the latest `skeeditor-safari-<version>.dmg` from [GitHub Releases](https://github.com/selfagency/skeeditor/releases).
2. Open the DMG and drag the app to `/Applications`.
3. Open the app once to register the extension with Safari.
4. In Safari, open **Settings → Extensions**.
5. Enable **skeeditor** and click **Always Allow on bsky.app**.

::: info Developer builds
To load an unsigned Safari extension during development, enable Safari → Settings → Advanced → **Show features for web developers**, then in Safari → Develop → **Allow Unsigned Extensions**.
:::

---

## Permissions

When you install skeeditor, your browser will ask for these permissions:

| Permission                 | Why it is needed                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `storage`                  | Stores your OAuth session tokens securely in extension storage                            |
| `activeTab`                | Reads the current tab's URL to know when you are on bsky.app                              |
| `https://bsky.app/*`       | Injects the edit UI into bsky.app pages and intercepts post navigation                    |
| `https://*.bsky.network/*` | Makes authenticated calls to the Bluesky PDS (Personal Data Server) to fetch/save records |

skeeditor requests no other permissions. It does not access your browser history, bookmarks, clipboard (beyond what you paste into the editor), or any other site.
