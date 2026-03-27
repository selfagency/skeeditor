# skeeditor ✏️🦋

> **The edit button Bluesky never gave you. Until now.**

You know the feeling — you hit post, look at it for 0.3 seconds, and spot a typo. Or a bad take that needs a _slightly_ less bad take. Bluesky doesn't have an edit button, but why should that stop us?

**skeeditor** is a cross-browser extension that adds a real, working **✏️ Edit** button to your posts on [bsky.app](https://bsky.app). Click it, fix your regrets, save. Done. No copy-paste gymnastics, no deleting and reposting, no shame spiral.

It authenticates via OAuth 2.0 + PKCE, fetches the actual record from the Bluesky PDS, and writes it back — preserving your links, mentions, hashtags, embeds, and timestamps like nothing ever happened. 🤫

**[📖 Full documentation →](https://docs.skeeditor.link/)** | **[🦋 Bluesky Account: @skeeditor.link](https://bsky.app/profile/skeeditor.link)**

---

## ✨ Features

- **🖊️ In-place editing** — an edit button appears right on bsky.app next to your posts, where it always should have been
- **🔒 Secure by design** — OAuth 2.0 + PKCE; tokens stored only in extension storage, never sent to any third party
- **💅 Rich text preserved** — links, @mentions, and #hashtags are re-detected and byte-offset facets recalculated on every save
- **🛡️ Conflict-safe** — CID-based optimistic locking detects concurrent edits and prompts before overwriting
- **🌍 Cross-browser** — Chrome 120+, Firefox 125+, Safari (macOS 14+)

---

## Browser support

| Browser | Minimum version    |
| ------- | ------------------ |
| Chrome  | 120+               |
| Firefox | 125+               |
| Safari  | macOS 14+ (Sonoma) |

---

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Chrome or Firefox for manual testing

### Install

```sh
git clone https://github.com/selfagency/skeeditor.git
cd skeeditor
pnpm install
```

### Build

```sh
pnpm build:chrome    # → dist/chrome/
pnpm build:firefox   # → dist/firefox/
pnpm build:safari    # → dist/safari/ (macOS, requires Xcode)
pnpm build           # alias for build:chrome
```

Watch mode:

```sh
pnpm build:watch:chrome
pnpm build:watch:firefox
```

### Load in your browser

**Chrome**: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome/`

**Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`

**Safari**: Build, then open the generated Xcode project under `dist/safari/` and run it. See [Cross-Browser Platform docs](https://docs.skeeditor.link/dev/platform) for full instructions.

### Debugging in VS Code

1. **Launch mode** (simplest):
   - Hit **F5** with **"Debug: Full Extension (build + launch + content)"** selected.
   - VS Code will build the extension, open a fresh Chrome instance with the extension pre-loaded, and attach the debugger to the content script context on bsky.app.
   - Breakpoints in TypeScript source will be hit automatically.

2. **Attach mode** (keeps your normal Chrome profile):
   - Run the task **"Open Chrome (remote debug on 9222)"** (or launch Chrome manually with `--remote-debugging-port=9222`).
   - Select **"Debug: Content Script on bsky.app (attach)"** and hit F5.
   - VS Code will attach to the running Chrome instance and breakpoints will work.

3. **Debugging the service worker or popup**:
   - Use **"Debug: Service Worker (attach)"** or **"Debug: Popup (attach)"** after launching Chrome with remote debugging enabled.

All configs support source maps and skip third-party scripts (hls.js, etc.) to avoid noisy warnings.

See `.vscode/launch.json` and `.vscode/tasks.json` for full configuration details.

### Test

```sh
pnpm test               # unit + integration
pnpm test:unit          # Vitest (jsdom + browser API mocks)
pnpm test:integration   # Vitest + MSW (HTTP mocking)
pnpm test:e2e           # Playwright (Chrome + Firefox, requires built dist/)
pnpm test:watch         # watch mode
```

### Code quality

```sh
pnpm lint          # oxlint
pnpm format        # oxfmt (write)
pnpm format:check  # oxfmt (check only)
pnpm typecheck     # tsc --noEmit
```

### Lexicons

```sh
pnpm lex:install   # download AT Protocol lexicon JSON files
pnpm lex:build     # compile lexicons → TypeScript types in src/lexicons/
pnpm lex:sync      # both steps in order
```

---

## Architecture

The extension has three contexts that communicate via typed runtime messages:

- **Content script** (`src/content/`) — runs on bsky.app; detects your posts, injects the Edit badge, shows the edit modal
- **Background worker** (`src/background/`) — manages OAuth tokens, makes all XRPC calls to the Bluesky PDS
- **Popup** (`src/popup/`) — toolbar button UI for sign-in, sign-out, and auth status

Tokens never touch the content script. All authenticated network requests go through the background worker.

See the [Architecture](https://docs.skeeditor.link/dev/architecture) and [Message Protocol](https://docs.skeeditor.link/dev/messages) docs for details.

---

## Documentation

| Section                                                              | Description                                         |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| [User Guide](https://docs.skeeditor.link/guide/introduction)       | Installation, usage, privacy & security, FAQ        |
| [Architecture](https://docs.skeeditor.link/dev/architecture)       | Extension context model, data flow                  |
| [Getting Started](https://docs.skeeditor.link/dev/getting-started) | Dev environment setup                               |
| [Build System](https://docs.skeeditor.link/dev/build)              | Vite config, per-browser builds, manifest merging   |
| [Testing](https://docs.skeeditor.link/dev/testing)                 | Unit, integration, E2E test layers                  |
| [Contributing](https://docs.skeeditor.link/dev/contributing)       | Beans workflow, branch naming, TDD, PR requirements |
| [Authentication](https://docs.skeeditor.link/dev/auth)             | OAuth PKCE flow, token storage, session management  |
| [XRPC Client](https://docs.skeeditor.link/dev/xrpc)                | `getRecord`, `putRecordWithSwap`, conflict handling |
| [Facets & Rich Text](https://docs.skeeditor.link/dev/facets)       | Link/mention/hashtag detection, byte offsets        |
| [Cross-Browser Platform](https://docs.skeeditor.link/dev/platform) | API differences, manifest structure, Safari setup   |

---

## Contributing

All work is tracked with [Beans](https://usebeans.io/). Before writing code, find or create a bean and create the issue branch. All changes require tests (TDD: red → green → refactor). See [Contributing](https://docs.skeeditor.link/dev/contributing) for the full workflow.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). PRs require passing CI (lint, typecheck, unit + integration tests) and must reference a bean ID.

---

## License

MIT © [selfagency](https://github.com/selfagency)
