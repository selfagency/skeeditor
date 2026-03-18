---
# skeeditor-4pqr
title: Implement session token storage in browser.storage.local
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:28:41Z
updated_at: 2026-03-18T14:49:43Z
parent: skeeditor-1e94
---

Store OAuth tokens and session metadata securely in `browser.storage.local` with TTL and refresh metadata. Provide helper APIs for reading/writing and token encryption guidance.

## Todo

- [ ] Define token storage schema (access_token, refresh_token, expires_at, scope, did)
- [ ] Implement helper `sessionStore.get()` / `sessionStore.set()` / `sessionStore.clear()` APIs
- [ ] Add optional lightweight encryption/obfuscation guidance for sensitive fields and `.env.example` warnings
- [ ] Add Vitest unit tests for storage helpers (mock `browser.storage`)
- [ ] Document migration/format change guidance in `docs/auth.md`
