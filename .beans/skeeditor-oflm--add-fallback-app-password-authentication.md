---
# skeeditor-oflm
title: 'Add fallback: app password authentication'
status: in-progress
type: feature
priority: normal
created_at: 2026-03-18T14:28:56Z
updated_at: 2026-03-20T03:36:41Z
parent: skeeditor-1e94
blocked_by:
    - skeeditor-v7k9
---

##Todo

- [x] Design UI flow for entering an app-password (Web Component optional)
- [x] Implement secure storage guidance and validation for app-passwords
- [x] Add Vitest tests to validate auth fallback behavior and error handling
- [x] Document security trade-offs and recommend OAuth PKCE as primary method

##Summary of Changes

- `src/shared/auth/app-password.ts` — new module with:
  - `AppPasswordAuthResult` interface (accessToken, refreshToken?, expiresAt, did)
  - `LoginResponse` interface (accessJwt, refreshJwt?, did, handle)
  - `AppPasswordAuthError` class for authentication failures
  - `authenticateWithAppPassword(pdsUrl, identifier, password)` — calls PDS login endpoint
  - `validateAppPassword(password)` — basic validation (8-128 chars, letter+number)
  - `maskAppPassword(password)` — secure display (show first 4, last 4 chars)
  - TypeScript error with `exactOptionalPropertyTypes` being handled - explicit variable typing for refreshToken
- Tests and documentation to follow
- Security note: App passwords are less secure than OAuth PKCE (no expiry, no DPoP)
