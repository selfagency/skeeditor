---
# skeeditor-ogi2
title: Auto-switch account on profile navigation (Phase F)
status: completed
type: feature
priority: high
created_at: 2026-03-26T22:38:20Z
updated_at: 2026-03-26T22:45:14Z
---

branch: feat/ogi2-auto-switch-account-on-profile-nav

## Todo

- [ ] Add `knownAccounts` cache + `loadKnownAccounts()` via AUTH_LIST_ACCOUNTS
- [ ] Implement `checkProfileSwitch(url)` — match handle/DID, send AUTH_SWITCH_ACCOUNT if needed
- [ ] Patch `history.pushState` / `history.replaceState` to detect SPA navigation
- [ ] Add `popstate` listener for browser back/forward
- [ ] Call `loadKnownAccounts()` on start and after `AUTH_SWITCH_ACCOUNT`
- [ ] Clean up navigation listeners in `cleanupContentScript()`
- [ ] Unit tests: checkProfileSwitch matches by handle, by DID, no-op if already active
- [ ] Unit tests: SPA nav → profile switch → re-scan
- [ ] Run full test suite, typecheck



## Summary of Changes

- Added `loadKnownAccounts()` to cache all known accounts via `AUTH_LIST_ACCOUNTS` on content script startup
- Added `extractProfileIdentifier(url)` to extract handle/DID from `/profile/{identifier}` URLs
- Added `checkProfileSwitch(url)` to match the current profile URL against known non-active accounts by handle or DID; on match: sends `AUTH_SWITCH_ACCOUNT`, reloads accounts, refreshes auth state, removes injected elements, rescans posts
- Added `ensureNavigationListeners()` to patch `history.pushState`/`replaceState` and listen to `popstate` for SPA navigation interception
- Modified `start()` to call `ensureNavigationListeners()` and run `refreshAuthState()` + `loadKnownAccounts()` in parallel via `Promise.all`
- Modified `cleanupContentScript()` to restore patched history methods, remove the popstate listener, and clear `knownAccounts`
- 6 new unit tests: startup account load, handle match, DID match, already-active no-op, non-profile URL no-op, popstate trigger
- All 14 content-script unit tests pass; full suite 367/371 (4 pre-existing E2E)
- Typecheck clean
