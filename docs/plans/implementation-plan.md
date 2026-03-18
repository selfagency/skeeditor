# Implementation Plan — Bluesky Post Editor Extension

## Product Goal

A cross-browser extension (Chrome, Firefox, Safari) that allows authenticated Bluesky users to **edit their own previous posts** directly on `bsky.app`. The extension injects an "Edit" button into the post UI, opens an edit modal, and writes the updated record back to the user's AT Protocol data repository via `com.atproto.repo.putRecord`.

---

## AT Protocol — Editing Mechanics

### How Posts Work

Posts in Bluesky are AT Protocol records stored under the `app.bsky.feed.post` collection in a user's personal data repository. Each post is addressed by:

```txt
at://<did>/app.bsky.feed.post/<rkey>
```

- `did` — the user's decentralized identifier (e.g., `did:plc:abc123...`)
- `rkey` — a Timestamp ID (TID) assigned at creation time

### The Edit Flow (Protocol Level)

```txt
1. READ the existing post:
   GET /xrpc/com.atproto.repo.getRecord
     ?repo=<did>
     &collection=app.bsky.feed.post
     &rkey=<rkey>
   → { uri, cid, value: { $type, text, createdAt, facets?, embed?, reply?, langs?, ... } }

2. MODIFY the record's `value`:
   - Update `text` field with user's edits.
   - Recalculate `facets` array (rich text annotations) — byte offsets into UTF-8 text.
   - Preserve `createdAt`, `reply`, `embed`, `langs`, and all other fields.
   - Optionally add an `editedAt` or `editHistory` convention (not yet in the Lexicon).

3. WRITE the updated record:
   POST /xrpc/com.atproto.repo.putRecord
   {
     "repo": "<did>",
     "collection": "app.bsky.feed.post",
     "rkey": "<rkey>",
     "swapRecord": "<original cid>",   // optimistic concurrency control
     "record": { ...modified value }
   }
   → { uri, cid } (new CID reflecting updated content)
```

### Important Constraints

- **`swapRecord`**: If the record was modified between the read and the write (e.g., by another client), the PDS returns an error. The extension must catch this, re-fetch, and prompt the user.
- **Facet recalculation**: Facets use **byte offsets** into UTF-8 text, not character indices. Inserting a single emoji (multi-byte) shifts all subsequent facet offsets. This is a critical correctness concern.
- **`createdAt` must be preserved**: Overwriting it would change timeline sort order.
- **Embeds**: Images and external link cards are referenced via `BlobRef` and embed objects. Edits to text should not disturb embed references unless the user explicitly removes them.
- **Validation**: The complete record must validate against `app.bsky.feed.post` Lexicon schema before submission.
- **Read-after-write**: The PDS provides read-after-write semantics via `Atproto-Repo-Rev` headers. After a successful `putRecord`, subsequent reads from the same session will reflect the update even if the App View hasn't indexed it yet.

### Using `@atproto/lex` SDK

```typescript
import { Client } from '@atproto/lex'
import * as Post from './lexicons/app/bsky/feed/post'

// Read
const { value, cid } = await client.get(Post, { rkey })

// Modify
const updatedRecord = Post.$build({
  ...value,
  text: newText,
  facets: recalculatedFacets,
})

// Write
await client.put(Post, {
  rkey,
  swapRecord: cid,
  record: updatedRecord,
})
```

---

## Directory Structure

```txt
bsky-post-editor/
├── .beans/                          # Beans task tracking directory
├── .github/
│   ├── instructions/
│   │   └── copilot-instructions.md  # Generalized Copilot instructions
│   ├── skills/beans/SKILL.md
│   └── workflows/
│       └── ci.yml                   # GitHub Actions CI pipeline
├── docs/
│   └── implementation-plan.md       # This file
├── src/
│   ├── shared/                      # Cross-browser shared code (no browser API deps)
│   │   ├── api/
│   │   │   ├── atproto-client.ts    # XRPC client wrapper (fetch-based)
│   │   │   ├── auth.ts              # OAuth session management types/helpers
│   │   │   ├── post.ts              # getPost(), updatePost(), record manipulation
│   │   │   └── types.ts             # AT Protocol shared type definitions
│   │   ├── utils/
│   │   │   ├── facets.ts            # Facet detection (mentions, links, tags)
│   │   │   ├── facet-offsets.ts     # UTF-8 byte offset calculation & recalculation
│   │   │   ├── text.ts              # Grapheme segmentation, byte length helpers
│   │   │   └── uri.ts              # AT URI parsing (extract did, collection, rkey)
│   │   └── constants.ts             # Collection NSIDs, API endpoints, limits
│   ├── content/                     # Content script (injected into bsky.app pages)
│   │   ├── content-script.ts        # MutationObserver, "Edit" button injection
│   │   ├── edit-modal.ts            # Modal Web Component: textarea, save/cancel, status
│   │   ├── post-detector.ts         # Find post elements, extract rkey from URL/DOM
│   │   └── styles.css               # Modal and button styling
│   ├── background/                  # Service worker (Chrome/Safari) / background script (Firefox)
│   │   ├── service-worker.ts        # Message handler, auth orchestration, XRPC proxy
│   │   ├── message-router.ts        # Typed message passing (content ↔ background)
│   │   └── session-store.ts         # Token storage and refresh logic
│   ├── popup/                       # Browser action popup (login status, quick actions)
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── options/                     # Settings page (PDS URL override, preferences)
│   │   ├── options.html
│   │   ├── options.ts
│   │   └── options.css
│   └── platform/                    # Platform-specific shims & overrides
│       ├── chrome/
│       │   └── shim.ts
│       ├── firefox/
│       │   └── shim.ts
│       └── safari/
│           └── shim.ts
├── test/
│   ├── unit/
│   │   ├── api/
│   │   │   ├── atproto-client.test.ts
│   │   │   └── post.test.ts
│   │   ├── utils/
│   │   │   ├── facets.test.ts
│   │   │   ├── facet-offsets.test.ts
│   │   │   ├── text.test.ts
│   │   │   └── uri.test.ts
│   │   └── content/
│   │       ├── edit-modal.test.ts
│   │       └── post-detector.test.ts
│   ├── integration/
│   │   ├── edit-flow.test.ts        # Full read → modify → write cycle (MSW-mocked)
│   │   ├── auth-flow.test.ts        # OAuth token acquisition and refresh
│   │   └── conflict-flow.test.ts    # swapRecord conflict handling
│   ├── e2e/
│   │   ├── chrome.spec.ts           # Chrome extension loading + edit flow
│   │   ├── firefox.spec.ts          # Firefox extension loading + edit flow
│   │   └── fixtures/
│   │       └── mock-bsky-page.html  # Static bsky.app-like page for E2E
│   └── mocks/
│       ├── handlers.ts              # MSW request handlers for XRPC endpoints
│       ├── records.ts               # Sample app.bsky.feed.post records
│       └── browser-apis.ts          # chrome.*/browser.* API stubs
├── manifests/
│   ├── base.json                    # Shared manifest fields
│   ├── chrome/
│   │   └── manifest.json
│   ├── firefox/
│   │   └── manifest.json
│   └── safari/
│       └── manifest.json
├── scripts/
│   ├── build.ts                     # Vite/esbuild build for Chrome + Firefox
│   ├── build-safari.sh              # xcrun safari-web-extension-converter wrapper
│   ├── dev-chrome.ts                # Watch mode + Chrome load-unpacked
│   ├── dev-firefox.ts               # Watch mode + web-ext run
│   └── merge-manifest.ts            # Merge base.json + browser overrides
├── lexicons/                        # Installed Lexicon JSON files (via `lex install`)
├── lexicons.json                    # Lexicon manifest
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── tsconfig.build.json
├── package.json
├── .eslintrc.cjs
├── .prettierrc
└── README.md
```

---

## Epic Decomposition

### Milestone: `v0.1.0 — MVP Post Editing`

#### Epic 1: Project Scaffolding & Build Pipeline

- [ ] `Initialize monorepo structure` — type=`task`, priority=`critical`, depends_on=`none`
- [ ] `Configure Vite multi-entry build for content, background, popup` — type=`task`, priority=`critical`, depends_on=`none`
- [ ] `Set up manifests (Chrome MV3, Firefox MV3 w/ gecko ID, Safari MV3)` — type=`task`, priority=`critical`, depends_on=`none`
- [ ] `Configure Vitest with browser API mocks` — type=`task`, priority=`critical`, depends_on=`none`
- [ ] `Configure Playwright for extension E2E (Chrome + Firefox)` — type=`task`, priority=`high`, depends_on=`none`
- [ ] `Set up GitHub Actions CI pipeline` — type=`task`, priority=`high`, depends_on=`none`
- [ ] `Add Safari build script (xcrun converter)` — type=`task`, priority=`normal`, depends_on=`none`
- [ ] `Install Lexicons (app.bsky.feed.post, com.atproto.repo.*) and generate TS schemas` — type=`task`, priority=`critical`, depends_on=`none`

#### Epic 2: AT Protocol Client Layer

- [ ] `Implement AT URI parser (extract did, collection, rkey)` — type=`feature`, priority=`critical`, depends_on=`none`
- [ ] `Implement UTF-8 byte length and grapheme utilities` — type=`feature`, priority=`critical`, depends_on=`none`
- [ ] `Implement facet detection (mentions, links, hashtags)` — type=`feature`, priority=`critical`, depends_on=`none`
- [ ] `Implement facet byte-offset recalculation on text change` — type=`feature`, priority=`critical`, depends_on=`facet-detection`
- [ ] `Implement XRPC client wrapper (getRecord, putRecord)` — type=`feature`, priority=`critical`, depends_on=`uri-parser`
- [ ] `Implement putRecord with swapRecord concurrency control` — type=`feature`, priority=`critical`, depends_on=`xrpc-client`
- [ ] `Implement swapRecord conflict detection and retry` — type=`feature`, priority=`high`, depends_on=`put-record`
- [ ] `Add full-record Lexicon validation before putRecord` — type=`feature`, priority=`high`, depends_on=`put-record`

#### Epic 3: Authentication

- [ ] `Implement OAuth PKCE flow for browser extensions` — type=`feature`, priority=`critical`, depends_on=`none`
- [ ] `Implement session token storage in browser.storage.local` — type=`feature`, priority=`critical`, depends_on=`oauth-flow`
- [ ] `Implement automatic token refresh in service worker` — type=`feature`, priority=`critical`, depends_on=`session-storage`
- [ ] `Implement login/logout UI in popup` — type=`feature`, priority=`high`, depends_on=`oauth-flow`
- [ ] `Add fallback: app password authentication` — type=`feature`, priority=`normal`, depends_on=`none`

#### Epic 4: Content Script & UI

- [ ] `Implement MutationObserver to detect post elements on bsky.app` — type=`feature`, priority=`critical`, depends_on=`none`
- [ ] `Implement post rkey extraction from DOM/URL` — type=`feature`, priority=`critical`, depends_on=`uri-parser`
- [ ] `Inject "Edit" button into own-post action menus` — type=`feature`, priority=`critical`, depends_on=`post-detection, auth`
- [ ] `Build edit modal component (textarea, char count, save/cancel) as a Web Component` — type=`feature`, priority=`critical`, depends_on=`none`
- [ ] `Wire edit modal to background service worker via message passing` — type=`feature`, priority=`critical`, depends_on=`edit-modal, xrpc-client`
- [ ] `Display edit success/error feedback in modal` — type=`feature`, priority=`high`, depends_on=`wire-modal`
- [ ] `Handle post text with existing facets in edit textarea` — type=`feature`, priority=`high`, depends_on=`facet-recalc, edit-modal`
- [ ] `Style modal to match bsky.app design language (Web Component styles / Shadow DOM considerations)` — type=`task`, priority=`normal`, depends_on=`edit-modal`

#### Epic 5: Message Passing & Background Orchestration

- [ ] `Define typed message protocol (content ↔ background)` — type=`feature`, priority=`critical`, depends_on=`none`
- [ ] `Implement message router in service worker` — type=`feature`, priority=`critical`, depends_on=`message-protocol`
- [ ] `Route getRecord requests from content script` — type=`feature`, priority=`critical`, depends_on=`message-router, xrpc-client`
- [ ] `Route putRecord requests from content script` — type=`feature`, priority=`critical`, depends_on=`message-router, xrpc-client`
- [ ] `Route auth status queries from content script and popup` — type=`feature`, priority=`high`, depends_on=`message-router, auth`

#### Epic 6: Cross-Browser Compatibility

- [ ] `Integrate webextension-polyfill for browser.* normalization` — type=`task`, priority=`high`, depends_on=`none`
- [ ] `Test and fix Chrome-specific behaviors` — type=`task`, priority=`high`, depends_on=`mvp-complete`
- [ ] `Test and fix Firefox-specific behaviors (web-ext)` — type=`task`, priority=`high`, depends_on=`mvp-complete`
- [ ] `Convert and test in Safari via Xcode` — type=`task`, priority=`normal`, depends_on=`mvp-complete`
- [ ] `Handle Safari API incompatibilities (document and shim)` — type=`task`, priority=`normal`, depends_on=`safari-convert`
- [ ] `Add platform shims for identity/auth API differences` — type=`feature`, priority=`normal`, depends_on=`none`

#### Epic 7: E2E Test Suite

- [ ] `E2E: extension loads and injects content script on bsky.app` — type=`test`, priority=`high`, depends_on=`content-script`
- [ ] `E2E: edit button appears on own posts only` — type=`test`, priority=`high`, depends_on=`edit-button`
- [ ] `E2E: edit modal opens, shows current text, saves edit` — type=`test`, priority=`high`, depends_on=`edit-modal`
- [ ] `E2E: unauthenticated user sees login prompt, not edit button` — type=`test`, priority=`normal`, depends_on=`auth`
- [ ] `E2E: concurrent edit conflict shows retry prompt` — type=`test`, priority=`normal`, depends_on=`conflict-handling`

---

## Key Technical Decisions

| Decision          | Choice                                 | Rationale                                                                                                                                   |
| :---------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| Language          | TypeScript (strict)                    | Type safety for AT Protocol records, facet byte math, cross-browser APIs                                                                    |
| Bundler           | Vite                                   | Fast builds, multi-entry support, good extension ecosystem                                                                                  |
| Test runner       | Vitest (unit & integration)            | Fast, native ESM/TS, compatible with Vite config; use Vitest for unit and integration tests                                                 |
| E2E framework     | Playwright                             | Native extension loading support for Chrome + Firefox; Playwright is used only for E2E tests while Vitest covers unit and integration tests |
| HTTP mocking      | MSW (Mock Service Worker)              | Intercepts at network level, works with any fetch-based client                                                                              |
| AT Protocol SDK   | `@atproto/lex`                         | Official SDK, type-safe Lexicon tooling, `Client` with `get()`/`put()`                                                                      |
| Browser polyfill  | `webextension-polyfill`                | Normalizes `chrome.*` ↔ `browser.*` with Promises                                                                                           |
| Auth method       | OAuth with PKCE                        | Official recommendation for client apps, no password storage                                                                                |
| Manifest version  | V3 (all browsers)                      | Required for Chrome, supported by Firefox and Safari                                                                                        |
| Safari conversion | `xcrun safari-web-extension-converter` | Official Apple tooling, generates Xcode project from MV3 extension                                                                          |

---

UI components: We will implement interactive UI (edit modal, popup, options pages) as Web Components — framework-agnostic, encapsulated with Shadow DOM, compatible with Vite and plain TypeScript. This keeps UI logic portable across browser platforms and avoids a framework dependency.

## Risk Register

| Risk                                                                             | Impact | Mitigation                                                                        |
| :------------------------------------------------------------------------------- | :----- | :-------------------------------------------------------------------------------- |
| Bluesky adds native edit support, making extension redundant                     | High   | Monitor bsky.app releases; pivot to value-add features (edit history, undo)       |
| `putRecord` on posts causes unexpected side effects (broken threads, lost likes) | High   | Extensive integration testing; preserve all non-text fields; validate full record |
| Facet byte-offset bugs corrupt rich text rendering                               | High   | Comprehensive unit tests with multi-byte chars (emoji, CJK, RTL); fuzzing         |
| OAuth flow complexity in extension context                                       | Medium | Use official `@atproto/oauth-client`; fall back to app passwords                  |
| Safari API incompatibilities block features                                      | Medium | Feature-detect and degrade gracefully; document known gaps                        |
| bsky.app DOM changes break content script selectors                              | Medium | Use stable `data-testid` attributes where possible; MutationObserver resilience   |
| `swapRecord` conflicts in high-activity scenarios                                | Low    | Retry loop with user confirmation; exponential backoff                            |

---

## Definition of Done (MVP)

- [ ] Authenticated user can click "Edit" on their own post on `bsky.app`
- [ ] Edit modal shows the current post text with correct rendering
- [ ] User can modify text, save, and see the update reflected
- [ ] Facets (mentions, links, tags) are correctly recalculated
- [ ] Embeds are preserved through edits
- [ ] Concurrent edit conflicts are handled gracefully
- [ ] Extension works in Chrome, Firefox, and Safari
- [ ] Unit test coverage ≥ 90% for `src/shared/`
- [ ] Integration tests cover the full edit flow with mocked XRPC
- [ ] E2E tests pass in Chrome and Firefox
- [ ] Safari build succeeds via converter (manual testing)
- [ ] All beans are closed with `## Summary of Changes`
