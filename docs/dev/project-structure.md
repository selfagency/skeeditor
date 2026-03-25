# Project Structure

```text
skeeditor/
├── docs/                        # VitePress documentation site
│   ├── .vitepress/
│   │   └── config.ts            # VitePress site configuration
│   ├── guide/                   # User-facing documentation
│   └── dev/                     # Developer documentation
│
├── lexicons/                    # AT Protocol Lexicon JSON files
│   ├── app/bsky/                # Bluesky app lexicons
│   └── com/atproto/             # Core AT Protocol lexicons
│
├── manifests/                   # Browser extension manifests
│   ├── base.json                # Shared fields (merged into every browser manifest)
│   ├── chrome/manifest.json     # Chrome-specific overrides
│   ├── firefox/manifest.json    # Firefox-specific overrides (gecko id, strict_min_version)
│   └── safari/manifest.json     # Safari-specific overrides
│
├── packages/                    # Internal workspace packages (if any)
│
├── scripts/                     # Build-time scripts
│   ├── build.ts                 # Main build orchestrator
│   ├── clean.ts                 # Removes dist/
│   ├── merge-manifest.ts        # Merges base.json + browser overlay → dist/<browser>/manifest.json
│   └── prepare-generated-lexicons.ts  # Processes lexicon JSON for use at runtime
│
├── src/                         # Extension source
│   ├── background/
│   │   ├── service-worker.ts    # Entry point for background context; registers message router
│   │   └── message-router.ts    # Routes incoming browser.runtime messages to handlers
│   │
│   ├── content/
│   │   ├── content-script.ts    # Entry point injected into bsky.app pages
│   │   ├── post-detector.ts     # DOM scanning: finds posts authored by you; extracts PostInfo
│   │   ├── post-badges.ts       # Injects Edit badge elements next to your posts
│   │   ├── post-editor.ts       # Orchestrates GET_RECORD → edit modal → PUT_RECORD
│   │   ├── edit-modal.ts        # In-page editor modal Web Component
│   │   └── styles.css           # Extension content styles
│   │
│   ├── lexicons/                # Generated TypeScript types from AT Protocol lexicons
│   │   ├── app.ts               # Re-exports from app/bsky.ts
│   │   ├── com.ts               # Re-exports from com/atproto.ts
│   │   └── tools.ts             # Re-exports from tools/ozone.ts
│   │
│   ├── options/                 # Extension options page (currently minimal)
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   │
│   ├── platform/                # Per-browser API shims
│   │   ├── chrome/              # Chrome-specific shim
│   │   ├── firefox/             # Firefox-specific shim
│   │   └── safari/              # Safari-specific shim
│   │
│   ├── popup/                   # Toolbar popup UI
│   │   ├── popup.html
│   │   ├── popup.ts             # Popup entry point; imports auth-popup Web Component
│   │   ├── auth-popup.ts        # <auth-popup> Web Component: sign in / out / status
│   │   └── popup.css
│   │
│   └── shared/                  # Code shared across all extension contexts
│       ├── constants.ts         # APP_NAME, BSKY origins, OAuth endpoints/scopes
│       ├── messages.ts          # Typed message union + ResponseFor<T> + sendMessage()
│       ├── api/
│       │   ├── at-uri.ts        # AT-URI parser and builder (AtUri class)
│       │   └── xrpc-client.ts   # XrpcClient: getRecord, putRecord, putRecordWithSwap
│       ├── auth/
│       │   ├── auth-client.ts   # OAuth PKCE client (initiate flow, exchange code, revoke)
│       │   ├── pkce.ts          # generateCodeVerifier / generateCodeChallenge utilities
│       │   ├── session-store.ts # SessionStore: read/write/clear tokens in browser.storage.local
│       │   ├── token-refresh.ts # TokenRefreshManager: deduplication, proactive refresh
│       │   └── types.ts         # OAuthTokens, Session, AuthStatus types
│       └── utils/
│           ├── facet-offsets.ts # UTF-8 byte offset helpers
│           ├── facets.ts        # detectLinks / detectMentions / detectHashtags / buildFacets
│           └── text.ts          # Text-manipulation helpers (grapheme count, etc.)
│
├── test/
│   ├── e2e/                     # Playwright end-to-end tests
│   │   ├── chrome.spec.ts       # Chrome extension E2E
│   │   ├── firefox.spec.ts      # Firefox extension E2E
│   │   └── fixtures/            # Playwright fixture helpers + mock bsky page
│   │
│   ├── integration/             # Vitest integration tests (with MSW HTTP mocking)
│   │   ├── api/
│   │   ├── auth/
│   │   └── health.test.ts
│   │
│   ├── mocks/                   # Shared test mocks
│   │   ├── browser-apis.ts      # chrome/browser API stubs
│   │   ├── handlers.ts          # MSW request handlers (XRPC mock responses)
│   │   └── server.ts            # MSW server setup
│   │
│   ├── setup/
│   │   ├── unit.ts              # Vitest unit setup (registers browser-api mocks)
│   │   └── integration.ts       # Vitest integration setup (starts/stops MSW server)
│   │
│   └── unit/                    # Vitest unit tests (jsdom)
│       ├── api/
│       ├── auth/
│       ├── background/
│       ├── content/
│       └── utils/
│
├── package.json                 # Root workspace package (scripts, devDependencies)
├── pnpm-workspace.yaml          # pnpm monorepo workspace definition
├── turbo.json                   # Turborepo pipeline (build, test, lint)
├── tsconfig.json                # Root TypeScript config (paths, strict)
├── tsconfig.build.json          # TypeScript config for production builds (excludes test/)
├── vite.config.ts               # Vite config (entry points, resolve aliases)
├── vitest.config.ts             # Vitest config (unit + integration environments)
└── playwright.config.ts         # Playwright config (E2E)
```

## Key path alias

All `src/` imports use the `@src` alias, which maps to the `src/` directory. This is configured in:

- `tsconfig.json` — `paths: { "@src/*": ["src/*"] }`
- `vite.config.ts` — `resolve.alias: { "@src": "src/" }`
- `vitest.config.ts` — same alias for test imports

Example:

```ts
import { sendMessage } from '@src/shared/messages';
import { XrpcClient } from '@src/shared/api/xrpc-client';
```
