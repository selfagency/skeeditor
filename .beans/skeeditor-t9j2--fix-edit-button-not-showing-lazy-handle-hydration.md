---
# skeeditor-t9j2
title: fix edit button not showing lazy handle hydration
status: in-progress
type: fix
priority: critical
created_at: 2026-03-26T16:15:14Z
updated_at: 2026-03-26T16:15:28Z
---

Edit buttons do not appear on own posts for two compounding reasons:

1. **Silent handle failure**: `fetchHandle()` in `AUTH_CALLBACK` can return `null` (DPoP nonce mismatch, network error, PDS error). When it does, the session is stored without a `handle` field. On next startup, `AUTH_GET_STATUS` returns `handle: undefined`, the content script sets `currentHandle = null`, and every feed post (whose `postInfo.repo` is a bsky.app handle, not a DID) is skipped.

2. **One-shot auth check**: `refreshAuthState()` runs only once when the content script initialises. If the tab was open before the user signed in (common: user opens bsky.app, then installs/enables the extension, then signs in via the popup), `currentDid` and `currentHandle` remain `null` for the entire page lifetime. No re-scan is triggered on login.

## Fix

**`src/background/message-router.ts`** — `AUTH_GET_STATUS` handler: if the session is valid but `stored.handle` is absent, call `fetchHandle(pdsUrl, stored.accessToken)` lazily, persist the result, then return the now-populated handle. Heals all existing sessions stored without a handle — user does not need to sign out and back in.

**`src/content/content-script.ts`** — add `browser.storage.onChanged` listener: when `'session'` changes (login, logout, token refresh), call `refreshAuthState()` then `scheduleScanForPosts()`. Edit buttons will appear immediately after login without a page reload.

branch: fix/t9j2-edit-button-lazy-handle-storage-listener

## Todo

- [x] `AUTH_GET_STATUS`: if `stored.handle` is falsy and token is valid, call `fetchHandle()`, persist handle, return updated handle
- [x] `content-script.ts`: add `browser.storage.onChanged` listener on `'session'` key
- [x] On session change: call `refreshAuthState()` + `scheduleScanForPosts()`; on sign-out, clear `currentDid`/`currentHandle` and remove processed markers
- [x] Write unit test: `AUTH_GET_STATUS` with missing handle triggers `fetchHandle` and returns populated handle
- [x] Write unit test: `AUTH_GET_STATUS` with missing handle where `fetchHandle` fails returns handle-less response (does not crash)
- [x] Write unit test: storage.onChanged with new session triggers refresh + scan
- [x] Write unit test: storage.onChanged with session removed clears auth state
- [x] `pnpm test` all pass
- [x] `tsc --noEmit` clean
- [ ] Commit + push
