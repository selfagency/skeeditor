---
# skeeditor-4pqr
title: Implement session token storage in browser.storage.local
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:28:41Z
updated_at: 2026-03-19T19:45:19Z
parent: skeeditor-1e94
blocked_by:
    - skeeditor-v7k9
---

Store OAuth tokens and session metadata securely in `browser.storage.local` with TTL and refresh metadata. Provide helper APIs for reading/writing and token encryption guidance.

## Todo

- [x] Define token storage schema (access_token, refresh_token, expires_at, scope, did)
- [x] Implement helper `sessionStore.get()` / `sessionStore.set()` / `sessionStore.clear()` APIs
- [x] Add optional lightweight encryption/obfuscation guidance for sensitive fields and `.env.example` warnings
- [x] Add Vitest unit tests for storage helpers (mock `browser.storage`)
- [x] Document migration/format change guidance in `docs/auth.md`

## Summary of Changes

- `src/shared/auth/session-store.ts` — `StoredSession` interface, `sessionStore.{ set, get, clear, isAccessTokenValid }` backed by `browser.storage.local`
- `test/unit/auth/session-store.test.ts` — 7 unit tests covering set, get (found/missing), clear, and access token validity logic
