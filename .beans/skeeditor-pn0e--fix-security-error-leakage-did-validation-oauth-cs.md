---
# skeeditor-pn0e
title: 'fix: security — error leakage, DID validation, OAuth CSRF, DRY auth helpers'
status: todo
type: bug
priority: high
created_at: 2026-03-25T17:56:11Z
updated_at: 2026-03-25T17:56:11Z
parent: skeeditor-pjwz
id: skeeditor-pn0e
---
Security and privacy hardening from the codebase audit:

1. **Error message leakage** — `xrpc-client.ts:228` and `message-router.ts:226-230` include `repo/collection/rkey` in error context strings. Strip these identifiers from surfaced errors.

2. **Unsafe DID cast** — `xrpc-client.ts:248-258` casts `config.did` to branded `did:${string}:${string}` type without format validation. Add a format check before the cast.

3. **OAuth CSRF verification** — `message-router.ts:308` stores `pendingAuth` but it needs to be confirmed that it is retrieved and `state` compared in the callback path. If not, add retrieval + comparison in the auth callback handler.

4. **Duplicate error-body parsing** — identical pattern in `auth-client.ts:70-90` and `token-refresh.ts:44-55`. Extract into a shared `parseOAuthErrorBody()` helper.

## Todo

- [ ] Read `src/shared/api/xrpc-client.ts` error context strings
- [ ] Strip rkey/collection/repo from error context without losing error codes
- [ ] Read `src/shared/auth/auth-client.ts` and `token-refresh.ts` error-body parsing
- [ ] Extract shared `parseOAuthErrorBody()` helper in `src/shared/auth/`
- [ ] Trace OAuth callback path: verify `pendingAuth` is retrieved and `state` checked
- [ ] Add DID format validation before cast in `xrpc-client.ts`
- [ ] Add/update unit tests for secure error handling and DID validation
- [ ] `pnpm test` + `tsc --noEmit` clean
- [ ] Commit with `fix(security)` prefix
