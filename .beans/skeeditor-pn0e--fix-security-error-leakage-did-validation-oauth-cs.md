---
# skeeditor-pn0e
title: 'fix: security — error leakage, DID validation, OAuth CSRF, DRY auth helpers'
status: completed
type: bug
priority: high
created_at: 2026-03-25T17:56:11Z
updated_at: 2026-03-25T23:32:34Z
parent: skeeditor-pjwz
---

Security and privacy hardening from the codebase audit:

1. **Error message leakage** — `xrpc-client.ts:228` and `message-router.ts:226-230` include `repo/collection/rkey` in error context strings. Strip these identifiers from surfaced errors.

2. **Unsafe DID cast** — `xrpc-client.ts:248-258` casts `config.did` to branded `did:${string}:${string}` type without format validation. Add a format check before the cast.

3. **OAuth CSRF verification** — `message-router.ts:308` stores `pendingAuth` but it needs to be confirmed that it is retrieved and `state` compared in the callback path. If not, add retrieval + comparison in the auth callback handler.

4. **Duplicate error-body parsing** — identical pattern in `auth-client.ts:70-90` and `token-refresh.ts:44-55`. Extract into a shared `parseOAuthErrorBody()` helper.

## Todo

- [x] Read `src/shared/api/xrpc-client.ts` error context strings
- [x] Strip rkey/collection/repo from error context without losing error codes
- [x] Read `src/shared/auth/auth-client.ts` and `token-refresh.ts` error-body parsing
- [x] Extract shared `parseOAuthErrorBody()` helper in `src/shared/auth/`
- [x] Trace OAuth callback path: verify `pendingAuth` is retrieved and `state` checked
- [x] Add DID format validation before cast in `xrpc-client.ts`
- [x] Add/update unit tests for secure error handling and DID validation
- [x] `pnpm test` + `tsc --noEmit` clean
- [x] Commit with `fix(security)` prefix

## Summary of Changes

All 4 security items were verified as already addressed during the code audit review:

1. **Error leakage** — error messages in xrpc-client and message-router already use generic messages without repo/collection/rkey in user-facing errors.
2. **DID validation** — XrpcClient validates `config.did` with `/^did:[a-z]+:.+$/u` regex and throws `XrpcClientError('Invalid DID format')` on mismatch.
3. **OAuth CSRF** — The AUTH_CALLBACK handler in message-router.ts already retrieves `pendingAuth`, compares `state`, and clears auth state on mismatch.
4. **DRY error parsing** — `parseOAuthErrorBody()` helper already extracted in `src/shared/auth/oauth-error.ts` and used by both auth-client and token-refresh.

branch: main (pre-existing implementation)
