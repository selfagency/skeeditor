---
# skeeditor-sykd
title: Implement login/logout UI in popup
status: completed
type: feature
priority: high
created_at: 2026-03-18T14:28:50Z
updated_at: 2026-03-19T19:54:56Z
parent: skeeditor-1e94
blocked_by:
    - skeeditor-v7k9
---

Popup UI to show login status, trigger OAuth sign-in, logout, and quick actions like reauthorize or switch accounts. Implement popup UI as a small Web Component to keep logic encapsulated and reusable.

## Todo

- [x] Create `auth-popup` Web Component and markup
- [x] Wire sign-in/sign-out flows to background via typed messages
- [x] Add account switch and reauthorize actions
- [x] Add tests (Vitest) for popup behavior

## Summary of Changes

- `src/popup/auth-popup.ts` — `<auth-popup>` Web Component (Shadow DOM, open mode):
  - Three states: `loading` (while session storage is being read), `unauthenticated` (no valid session), `authenticated` (valid session found)
  - Reads session via `sessionStore.get()` / `sessionStore.isAccessTokenValid()` directly from `browser.storage.local`
  - Sends typed `AuthMessage` to background via `browser.runtime.sendMessage`:
    - Sign-in button → `AUTH_SIGN_IN`
    - Sign-out button → `AUTH_SIGN_OUT` + optimistic transition to unauthenticated state
    - Reauthorize button → `AUTH_REAUTHORIZE`
  - Escapes DID in HTML output to prevent XSS
  - Guards `customElements.define` with `if (!customElements.get(...))` for test-safe re-import
- `src/popup/popup.ts` — updated to import `./auth-popup` (registers the custom element)
- `src/popup/popup.html` — replaced placeholder with `<auth-popup>` element
- `test/unit/popup/auth-popup.test.ts` — 9 unit tests covering: loading state, unauthenticated (no session, expired session), authenticated (DID display, button visibility), and message sending for each action
- All 161 tests pass; `tsc --noEmit` clean
