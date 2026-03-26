---
# skeeditor-p40f
title: 'Address PR #55 Copilot review comments'
status: completed
type: fix
priority: high
created_at: 2026-03-26T21:29:02Z
updated_at: 2026-03-26T21:33:26Z
---

Fix four issues flagged in Copilot review on PR #55.

## Todo

- [x] Add PDS URL input to authenticated state for "Add another account" (fix hardcoded bsky.social)
- [x] Validate DID format in AUTH_SWITCH_ACCOUNT + verify session exists before switching
- [x] Validate DID format in AUTH_SIGN_OUT_ACCOUNT
- [x] Optimize AUTH_LIST_ACCOUNTS: add listAll() to session-store for single-read account listing
- [x] Update tests for all changes
- [x] All tests green, typecheck clean

## Summary of Changes

- **`src/popup/auth-popup.ts`**: Added a PDS URL input (`#add-pds-url`) to the authenticated-state template above the "Add another account" button. The `add-account` click handler now reads from this input instead of hardcoding `https://bsky.social`, matching the behaviour of the sign-in flow in unauthenticated state.

- **`src/background/message-router.ts`**: 
  - `AUTH_SWITCH_ACCOUNT`: now validates the DID against `/^did:[a-z]+:.+$/u` and calls `getByDid()` to confirm a session exists before setting the active DID.
  - `AUTH_SIGN_OUT_ACCOUNT`: now validates the DID format before calling `clearForDid()`.
  - `AUTH_LIST_ACCOUNTS`: replaced N+1 `listDids()`+`getByDid()` loop with a single `listAll()` call.
  - `StoreInterface`: added `listAll()` method signature.

- **`src/shared/auth/session-store.ts`**: Added `listAll()` which reads both `sessions` and `activeDid` in one `browser.storage.local.get` call, returning `{ accounts: AccountSummary[]; activeDid: string | null }`. Exported `AccountSummary` interface.

- **Tests**: Updated store mocks in unit and integration tests to include `listAll`. Rewrote `AUTH_LIST_ACCOUNTS` tests to assert via `listAll`. Added tests for malformed DID and non-existent session in `AUTH_SWITCH_ACCOUNT`. Added malformed-DID test for `AUTH_SIGN_OUT_ACCOUNT`. Added `sessionStore.listAll` unit tests. Added auth-popup test for `#add-pds-url` in authenticated state.

345 unit + integration tests pass. Typecheck clean. Lint clean.
