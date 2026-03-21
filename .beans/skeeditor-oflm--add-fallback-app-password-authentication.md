---
# skeeditor-oflm
title: 'Add fallback: app password authentication'
status: completed
type: feature
priority: normal
created_at: 2026-03-18T14:28:56Z
updated_at: 2026-03-21T01:40:29Z
parent: skeeditor-1e94
blocked_by:
    - skeeditor-v7k9
branch: feat/oflm-app-password-auth
pr: 23
---

##Todo

- [x] Design UI flow for entering an app-password (Web Component optional)
- [x] Implement secure storage guidance and validation for app-passwords
- [x] Add Vitest tests to validate auth fallback behavior and error handling
- [x] Document security trade-offs and recommend OAuth PKCE as primary method

## Summary of Changes

- `src/shared/auth/app-password.ts` — new module with:
  - `AppPasswordAuthResult` interface (accessToken, refreshToken?, expiresAt, did)
  - `LoginResponse` interface (accessJwt, refreshJwt?, did, handle)
  - `AppPasswordAuthError` class for authentication failures
  - `authenticateWithAppPassword(pdsUrl, identifier, password)` — calls PDS login endpoint
  - `validateAppPassword(password)` — basic validation (8-128 chars, letter+number)
  - `maskAppPassword(password)` — secure display (show first 4, last 4 chars)
- `test/unit/auth/app-password.test.ts` — 25 unit tests covering all exported functions:
  - `validateAppPassword`: boundary conditions, letter-only, number-only, mixed
  - `maskAppPassword`: typical, short (≤8), long passwords
  - `authenticateWithAppPassword`: success path, missing refreshJwt, error status codes, error message propagation
- `test/integration/auth/app-password-flow.test.ts` — 6 MSW integration tests covering full HTTP flow:
  - Successful login returning session tokens
  - expiresAt set ~30 days in the future
  - 401 responses throw `AppPasswordAuthError` with correct status
  - Server error message propagated to thrown error
  - Correct JSON body sent to PDS endpoint
- Branch: feat/oflm-app-password-auth
- PR: #23
- Security note: App passwords are less secure than OAuth PKCE (no expiry, no DPoP); OAuth PKCE remains preferred
