---
# skeeditor-lqej
title: Multi-account popup UI (Phase D)
status: completed
type: feature
priority: high
created_at: 2026-03-26T20:09:05Z
updated_at: 2026-03-26T20:21:13Z
---

Update `auth-popup` Web Component to expose the multi-account storage added in Phase C (skeeditor-w0mg).

## What
Phase C added DID-keyed session storage (`sessions` map + `activeDid`). The popup still only shows the single active account. Phase D surfaces the full account list so users can:
1. See all signed-in accounts with their handles/DIDs
2. Switch the active account (sends `AUTH_SWITCH_ACCOUNT`)
3. Sign out of a single account (sends `AUTH_SIGN_OUT_ACCOUNT` with did)
4. Add another account (reuses `AUTH_SIGN_IN` flow — no session clearing)

## Scope

### Messages (src/shared/messages.ts)
- Added `AUTH_LIST_ACCOUNTS` → `{ accounts: { did, handle?, expiresAt, isActive }[] }`
- Added `AUTH_SWITCH_ACCOUNT { did }` — switches active DID
- Added `AUTH_SIGN_OUT_ACCOUNT { did }` — clears session for one DID

### Message router (src/background/message-router.ts)
- Extended `StoreInterface` with: `getByDid`, `clearForDid`, `listDids`, `getActiveDid`, `setActiveDid`
- Handle `AUTH_LIST_ACCOUNTS`: reads all DIDs + their sessions, returns list with isActive flag
- Handle `AUTH_SWITCH_ACCOUNT`: calls `setActiveDid(did)`, returns `{ ok: true }`
- Handle `AUTH_SIGN_OUT_ACCOUNT`: calls `clearForDid(did)`, returns `{ ok: true }`

### Popup (src/popup/auth-popup.ts)
- Removed direct `sessionStore` dependency — popup now loads accounts via `AUTH_LIST_ACCOUNTS`
- Account list renders each DID/handle with: active indicator, switch button (non-active), reauthorize (active), per-account sign-out
- "Add another account" button triggers `AUTH_SIGN_IN`
- After switch or sign-out, `loadAccounts()` re-fetches the list and re-renders

## Todo

- [x] Add AUTH_SWITCH_ACCOUNT, AUTH_SIGN_OUT_ACCOUNT, AUTH_LIST_ACCOUNTS message types
- [x] Implement router handlers for new messages
- [x] Update auth-popup to list accounts and support switching
- [x] Unit tests for new router handlers
- [x] Unit tests for updated auth-popup states
- [x] All unit + integration tests green, typecheck clean

## Summary of Changes

Added three new message types (`AUTH_LIST_ACCOUNTS`, `AUTH_SWITCH_ACCOUNT`, `AUTH_SIGN_OUT_ACCOUNT`) to `src/shared/messages.ts` with full type safety in `ResponseFor<T>`.

Extended `StoreInterface` in `message-router.ts` with the five new session-store methods introduced in Phase C, and added handlers for all three new message types.

Rewrote `auth-popup.ts` to replace the single-account `sessionStore.getAuthStatus()` call with `sendMessage({ type: 'AUTH_LIST_ACCOUNTS' })`, rendering a card per account with per-account switch, reauthorize, and sign-out buttons plus an "Add another account" action.

Rewrote the auth-popup unit tests to mock `sendMessage` responses instead of `browser.storage.local.get`, and added new multi-account scenarios. Updated the integration test store mock to satisfy the extended `StoreInterface`. All 335 unit + integration tests pass; typecheck and lint are clean.
