---
# skeeditor-v7k9
title: Implement OAuth PKCE flow for browser extensions
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:28:36Z
updated_at: 2026-03-18T14:49:39Z
parent: skeeditor-1e94
---

Implement OAuth PKCE authorization flow suitable for browser extensions (PKCE, redirect handling, deep-link or callback page), including guidance for client registration and required scopes.

## Todo

- [ ] Implement PKCE code challenge/verifier helper functions
- [ ] Implement sign-in request builder that opens auth URL with state and code_challenge
- [ ] Implement callback page handler that posts code to background for token exchange
- [ ] Add Vitest unit tests for PKCE helpers
- [ ] Add MSW-based integration tests for token exchange logic where feasible
- [ ] Document client registration steps and required scopes in `docs/auth.md`
