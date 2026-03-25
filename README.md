# skeeditor

A cross-browser extension that lets you **edit your own Bluesky posts directly on bsky.app** — no copy-paste to a third-party site required.

Click the **✏ Edit** badge on any of your posts, change the text, and save. skeeditor authenticates via OAuth 2.0 + PKCE, fetches the current record from the Bluesky PDS, and writes the updated record back — preserving rich-text facets, embeds, and timestamps automatically.

**[Full documentation →](https://selfagency.github.io/skeeditor/)**

---

## Features

- **In-place editing** — edit button appears directly on bsky.app next to your posts
- **Secure by design** — OAuth 2.0 + PKCE; tokens stored only in extension storage, never sent to any third party
- **Rich text preserved** — links, @mentions, and #hashtags are re-detected and byte-offset facets recalculated on every save
- **Conflict-safe** — CID-based optimistic locking detects concurrent edits and prompts before overwriting
- **Cross-browser** — Chrome 120+, Firefox 121+, Safari (macOS 14+)

---

## Browser support

| Browser | Minimum version    |
| ------- | ------------------ |
| Chrome  | 120+               |
| Firefox | 121+               |
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

**Safari**: Build, then open the generated Xcode project under `dist/safari/` and run it. See [Cross-Browser Platform docs](https://selfagency.github.io/skeeditor/dev/platform) for full instructions.

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

See the [Architecture](https://selfagency.github.io/skeeditor/dev/architecture) and [Message Protocol](https://selfagency.github.io/skeeditor/dev/messages) docs for details.

---

## Documentation

| Section                                                                       | Description                                         |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| [User Guide](https://selfagency.github.io/skeeditor/guide/introduction)       | Installation, usage, privacy & security, FAQ        |
| [Architecture](https://selfagency.github.io/skeeditor/dev/architecture)       | Extension context model, data flow                  |
| [Getting Started](https://selfagency.github.io/skeeditor/dev/getting-started) | Dev environment setup                               |
| [Build System](https://selfagency.github.io/skeeditor/dev/build)              | Vite config, per-browser builds, manifest merging   |
| [Testing](https://selfagency.github.io/skeeditor/dev/testing)                 | Unit, integration, E2E test layers                  |
| [Contributing](https://selfagency.github.io/skeeditor/dev/contributing)       | Beans workflow, branch naming, TDD, PR requirements |
| [Authentication](https://selfagency.github.io/skeeditor/dev/auth)             | OAuth PKCE flow, token storage, session management  |
| [XRPC Client](https://selfagency.github.io/skeeditor/dev/xrpc)                | `getRecord`, `putRecordWithSwap`, conflict handling |
| [Facets & Rich Text](https://selfagency.github.io/skeeditor/dev/facets)       | Link/mention/hashtag detection, byte offsets        |
| [Cross-Browser Platform](https://selfagency.github.io/skeeditor/dev/platform) | API differences, manifest structure, Safari setup   |

---

## Contributing

All work is tracked with [Beans](https://usebeans.io/). Before writing code, find or create a bean and create the issue branch. All changes require tests (TDD: red → green → refactor). See [Contributing](https://selfagency.github.io/skeeditor/dev/contributing) for the full workflow.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). PRs require passing CI (lint, typecheck, unit + integration tests) and must reference a bean ID.

---

## License

MIT © [selfagency](https://github.com/selfagency)
