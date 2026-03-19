---
# skeeditor-qnbm
title: Implement automatic token refresh in service worker
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:28:46Z
updated_at: 2026-03-19T19:49:39Z
parent: skeeditor-1e94
blocked_by:
    - skeeditor-4pqr
---

Service worker task to refresh access tokens before expiry, queue background requests while refreshing, and retry on failure.

## Todo

- [x] Implement refresh scheduler that triggers before `expires_at`
- [x] Implement request queuing while a refresh is in-flight
- [x] Handle refresh failures and surface to UI via messages
- [x] Add Vitest integration tests with MSW to simulate token expiry and refresh flows
- [x] Document expected behavior and failure modes in `docs/auth.md`

## Summary of Changes

- `src/shared/auth/token-refresh.ts` — new module exporting:
  - `refreshAccessToken(tokenEndpoint, refreshToken, clientId)` — POSTs `grant_type=refresh_token` to the AT Protocol token endpoint; throws `AuthClientError` on non-OK response
  - `TokenRefreshManager` — class with `refreshAndStore(current, refresh, store)` that:
    - De-duplicates concurrent refresh calls (only one network request in-flight at a time; callers queue on the same promise)
    - Maps `TokenResponse` → `StoredSession` (calculates `expiresAt`, retains existing refresh token if server doesn't return a new one)
    - Persists the updated session via the injected `store.set()`
- `test/unit/auth/token-refresh.test.ts` — 4 unit tests covering: correct arg passing, `expiresAt` calculation, refresh-token retention, and in-flight deduplication
- `test/integration/auth/token-refresh.test.ts` — 3 MSW integration tests covering: successful exchange, POST body shape, and HTTP error propagation as `AuthClientError`
- All 152 tests pass; `tsc --noEmit` clean
