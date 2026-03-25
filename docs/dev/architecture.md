# Architecture

skeeditor is a standard browser extension. Understanding the three extension contexts and how they communicate is the key to understanding the codebase.

## The three extension contexts

```text
┌────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│                                                                 │
│  ┌─────────────────────┐    messages    ┌────────────────────┐ │
│  │  Content Script     │◄──────────────►│ Background Worker  │ │
│  │  (bsky.app page)    │                │ (service worker)   │ │
│  │                     │                │                    │ │
│  │  • Detects posts    │                │ • Stores tokens    │ │
│  │  • Injects Edit btn │                │ • Makes XRPC calls │ │
│  │  • Shows modal      │                │ • Refreshes tokens │ │
│  └─────────────────────┘                └────────────────────┘ │
│                                                  ▲             │
│  ┌─────────────────────┐    messages             │             │
│  │  Popup              │─────────────────────────┘             │
│  │  (toolbar button)   │                                       │
│  │                     │                                       │
│  │  • Sign In / Out    │                                       │
│  │  • Auth status      │                                       │
│  └─────────────────────┘                                       │
└────────────────────────────────────────────────────────────────┘
```

### Content script (`src/content/`)

Runs in the context of every `https://bsky.app/*` page. It has access to the DOM but not to extension APIs like `chrome.storage`. Responsibilities:

- **Post detection** — scans the page for posts authored by the signed-in user and injects the Edit badge.
- **Edit modal** — renders the in-page text editor when Edit is clicked.
- **Post editor** — orchestrates fetching the record, showing the modal, and saving.

Because the content script cannot make authenticated XRPC calls directly, it sends typed messages to the background worker.

### Background worker (`src/background/`)

Runs as a Manifest V3 service worker (Chrome) or persistent background script (Firefox). It is the trusted core of the extension. Responsibilities:

- **Token storage** — reads/writes OAuth tokens in `browser.storage.local` via `SessionStore`.
- **Token refresh** — automatically refreshes expiring tokens via `TokenRefreshManager`.
- **XRPC calls** — receives `GET_RECORD` and `PUT_RECORD` messages from content/popup, makes the authenticated HTTP request, and returns the result.
- **OAuth flow** — handles the `AUTH_SIGN_IN` / `AUTH_SIGN_OUT` / `AUTH_REAUTHORIZE` messages from the popup.

### Popup (`src/popup/`)

A small Web Component UI rendered when the user clicks the toolbar button. It communicates with the background worker via `browser.runtime.sendMessage` to query auth status, trigger sign-in, and sign out.

---

## Data flow: editing a post

```text
User clicks Edit
      │
      ▼
content-script: post-detector extracts PostInfo (at-uri + text)
      │
      ▼
content-script: post-editor sends GET_RECORD → background
      │
      ▼
background: XrpcClient.getRecord(at-uri) → bsky.social
      │
      ▼
background → content-script: record { text, facets, cid }
      │
      ▼
content-script: edit-modal opens, user types
      │
      ▼
User clicks Save
      │
      ▼
content-script: detectFacets(newText), sends PUT_RECORD { record, swapCid } → background
      │
      ▼
background: XrpcClient.putRecordWithSwap(params) → bsky.social
      │
      ▼
SUCCESS → content-script updates DOM
CONFLICT → content-script shows conflict UI
ERROR    → content-script shows error message
```

---

## Key design decisions

### Background-centric authentication

All token access lives in the background worker, never in the content script. This ensures tokens cannot be exfiltrated by a malicious page via XSS or prototype pollution in the bsky.app context.

### Typed messages

All inter-context communication uses the typed `MessageRequest` union defined in `src/shared/messages.ts`. Each message type has a corresponding `ResponseFor<T>` type so TypeScript enforces the call/response contract at compile time.

### Platform shims

Browser API differences (service worker vs. persistent background, `chrome.*` vs `browser.*`, polyfill availability) are isolated in `src/platform/<browser>/`. The build system selects the correct shim at bundle time. Shared code always uses the `webextension-polyfill` (`browser.*`) API.

### Optimistic concurrency via CID

`putRecord` passes the CID from the fetched record as a `swapCid`. The PDS rejects writes where the record has changed, preventing silent overwrites. The extension surfaces the conflict to the user rather than silently discarding either version.
