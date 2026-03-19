---
# skeeditor-v7k9
title: Implement OAuth PKCE flow for browser extensions
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:28:36Z
updated_at: 2026-03-19T19:43:24Z
parent: skeeditor-1e94
---

Implement OAuth PKCE authorization flow suitable for browser extensions (PKCE, redirect handling, deep-link or callback page), including guidance for client registration and required scopes.

## Todo

- [x] Implement PKCE code challenge/verifier helper functions
- [x] Implement sign-in request builder that opens auth URL with state and code_challenge
- [x] Implement callback page handler that posts code to background for token exchange
- [x] Add Vitest unit tests for PKCE helpers
- [x] Add MSW-based integration tests for token exchange logic where feasible
- [x] Document client registration steps and required scopes in `docs/auth.md`

## Summary of Changes

- `src/shared/auth/pkce.ts` — `generateCodeVerifier()`, `deriveCodeChallenge()` (SHA-256 S256), `generateState()` using Web Crypto API
- `src/shared/auth/auth-client.ts` — `buildAuthorizationRequest()`, `exchangeCodeForTokens()`, `parseCallbackParams()`, `AuthClientError`
- `src/shared/auth/types.ts` — `OAuthClientParams`, `AuthorizationRequest`, `TokenResponse`, `CallbackParams` (discriminated union)
- `src/shared/constants.ts` — `BSKY_OAUTH_AUTHORIZE_URL`, `BSKY_OAUTH_TOKEN_URL`, `BSKY_OAUTH_SCOPE`
- `test/unit/auth/pkce.test.ts` — 11 unit tests for PKCE helpers
- `test/unit/auth/auth-client.test.ts` — 13 unit tests for auth client
- `test/integration/auth/auth-flow.test.ts` — 3 MSW integration tests for token exchange
- `docs/auth.md` — client registration, scopes, redirect URI strategy, security notes, follow-up bean map
