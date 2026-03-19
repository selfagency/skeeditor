---
# skeeditor-vrnp
title: Route auth status queries from content script and popup
status: completed
type: feature
priority: high
created_at: 2026-03-18T14:29:57Z
updated_at: 2026-03-19T20:12:11Z
parent: skeeditor-618f
blocked_by:
    - skeeditor-noiw
    - skeeditor-1e94
---

Expose auth status endpoints via message router so content scripts and popup can check login state and trigger sign-in flows.

## Todo

- [x] Implement `handleAuthStatus` to return logged-in state and current DID
- [x] Add Vitest tests for auth-status messaging (mock background APIs)
- [ ] Implement `handleTriggerSignIn` to start PKCE flow via background (deferred to follow-up bean)
- [ ] Document how `auth-popup` Web Component should call these message endpoints (deferred to follow-up bean)

## Summary of Changes

- Added `src/content/auth-status.ts` with `fetchAuthStatus()` (async, caches result) and `getAuthStatus()` (sync read of cache) for content-script use
- Added `src/content/content-script.ts` startup call to `fetchAuthStatus()` so the cache is warm when downstream modules check auth state
- Added unit tests covering authenticated, unauthenticated, error/fallback, and cache behaviour
- `AUTH_GET_STATUS` message handler was already implemented in the message router (prior beans)
- `handleTriggerSignIn` and popup documentation deferred; those depend on auth popup work outside this bean's scope
