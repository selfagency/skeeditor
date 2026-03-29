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
│   ├── agency/self/skeeditor/   # Custom skeeditor lexicons (e.g. postVersion record)
│   ├── app/bsky/                # Bluesky app lexicons
│   └── com/atproto/             # Core AT Protocol lexicons
│
├── packages/                    # Internal workspace packages
│   └── labeler/                 # Cloudflare Worker — skeeditor labeler service
│       ├── package.json
│       ├── tsconfig.json
│       ├── wrangler.jsonc       # Cloudflare Worker config (routes, bindings, vars)
│       └── src/
│           ├── index.ts         # Worker entry point (fetch handler)
│           ├── auth.ts          # DID authentication helpers
│           ├── hub.ts           # BroadcastHub Durable Object (subscription state)
│           ├── label.ts         # Label creation / signing logic
│           ├── did-document.ts  # DID document resolver
│           └── types.ts         # Shared types for the labeler worker
│
├── scripts/                     # Build-time scripts
│   ├── merge-manifest.ts        # Merges manifest overlays (legacy; not used by main WXT build)
│   └── prepare-generated-lexicons.ts  # Processes lexicon JSON for runtime use
│
├── src/                         # Extension source
│   ├── assets/
│   │   └── icon.svg             # Source icon — auto-icons generates PNGs from this
│   │
│   ├── background/
│   │   └── message-router.ts    # Routes incoming browser.runtime messages to handlers
│   │
│   ├── entrypoints/             # WXT entrypoints (discovered automatically by WXT)
│   │   ├── background.ts        # Background service worker entry point
│   │   ├── content.ts           # Content script entry point (injected into bsky.app)
│   │   ├── popup/
│   │   │   ├── index.html       # Popup HTML shell
│   │   │   └── main.ts          # Popup entry point — mounts the auth-popup component
│   │   └── options/
│   │       ├── index.html       # Options page HTML shell
│   │       └── main.ts          # Options page entry point
│   │
│   ├── content/
│   │   ├── content-script.ts    # Main content script: auth, scanning, label push, DOM patching
│   │   ├── post-detector.ts     # DOM scanning: finds posts across all bsky.app views; extracts PostInfo
│   │   ├── post-badges.ts       # Injects Edit badge elements next to your posts
│   │   ├── post-editor.ts       # Orchestrates GET_RECORD → edit modal → PUT_RECORD
│   │   ├── edit-modal.ts        # In-page editor modal Web Component
│   │   ├── edited-post-cache.ts # In-memory cache of edited post text; handle↔DID registry
│   │   └── styles.css           # Content-script styles
│   │
│   ├── lexicons/                # Generated TypeScript types from AT Protocol lexicons
│   │   ├── agency.ts            # Re-exports from agency/self/skeeditor (postVersion etc.)
│   │   ├── app.ts               # Re-exports from app/bsky.ts
│   │   ├── com.ts               # Re-exports from com/atproto.ts
│   │   └── tools.ts             # Re-exports from tools/ozone.ts
│   │
│   ├── platform/                # Per-browser API shims
│   │   ├── chrome/              # Chrome-specific shim
│   │   ├── firefox/             # Firefox-specific shim
│   │   └── safari/              # Safari-specific shim
│   │
│   ├── popup/
│   │   └── auth-popup.ts        # <auth-popup> Web Component: sign in/out, multi-account, status
│   │
│   └── shared/                  # Code shared across all extension contexts
│       ├── constants.ts         # APP_NAME, BSKY origins, OAuth endpoints, settings helpers
│       ├── logger.ts            # Shared debug logger (createLogger); no-op unless debug mode on
│       ├── messages.ts          # Typed message union + ResponseFor<T> + sendMessage()
│       ├── api/
│       │   ├── at-uri.ts        # AT-URI parser and builder (AtUri class)
│       │   └── xrpc-client.ts   # XrpcClient: getRecord, createRecord, putRecord, putRecordWithSwap
│       ├── auth/
│       │   ├── auth-client.ts   # OAuth PKCE client (initiate flow, exchange code, revoke)
│       │   ├── pkce.ts          # generateCodeVerifier / generateCodeChallenge utilities
│       │   ├── session-store.ts # Multi-account session store; keyed by DID in browser.storage.local
│       │   ├── token-refresh.ts # TokenRefreshManager: deduplication, proactive refresh
│       │   └── types.ts         # OAuthTokens, Session, AuthStatus types
│       └── utils/
│           ├── facet-offsets.ts # Recalculate facet byte offsets after text edits
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
│   │   ├── server.ts            # MSW server setup
│   │   └── wxt-utils.ts         # Stubs for wxt/utils/* (not resolvable outside WXT pipeline)
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
├── .wxt/                        # Generated by WXT (type stubs, tsconfig patches)
│                                # Not committed; regenerated by `pnpm install`
│
├── package.json                 # Root workspace package (scripts, devDependencies)
├── pnpm-workspace.yaml          # pnpm monorepo workspace definition
├── tsconfig.json                # Root TypeScript config (paths, strict)
├── tsconfig.build.json          # TypeScript config for production builds (excludes test/)
├── wxt.config.ts                # WXT build config (manifest, entrypoints, browser targets)
├── vitest.config.ts             # Vitest config (unit + integration environments)
└── playwright.config.ts         # Playwright config (E2E)
```

## Key path alias

All `src/` imports use the `@src` alias, which maps to the `src/` directory. This is configured in:

- `tsconfig.json` — `paths: { "@src/*": ["src/*"] }`
- `wxt.config.ts` — `resolve.alias: { "@src": "src/" }` (passed into Vite)
- `vitest.config.ts` — same alias for test imports

Example:

```ts
import { sendMessage } from "@src/shared/messages";
import { XrpcClient } from "@src/shared/api/xrpc-client";
```
