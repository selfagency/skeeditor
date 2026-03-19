---
# skeeditor-1e94
title: 'Epic 3: Authentication'
status: in-progress
type: epic
priority: critical
created_at: 2026-03-18T14:25:26Z
updated_at: 2026-03-19T19:04:05Z
parent: skeeditor-bmr4
---

Implement OAuth PKCE flow for extensions, token storage, automatic refresh, and popup login UI. Add app-password fallback.

UI note: Popup UI is implemented as a Web Component (`auth-popup`) to keep logic encapsulated; background auth orchestration remains in the service worker.

## Todo

- [ ] Design PKCE OAuth flow for browser extensions (redirect URI, callback page, state handling)
- [ ] Implement PKCE helpers (code challenge/verifier) and reusable utilities
- [ ] Implement secure callback handler page (callback.html) that exchanges code for tokens via background message
- [ ] Add Vitest integration tests for the OAuth flow pieces where possible (token storage, exchange logic) and MSW mocks for token endpoints
- [ ] Ensure required manifest changes (redirect/callback pages) are documented in `manifests/`
- [ ] Document required client registration steps and scopes in `docs/auth.md`
- [ ] Add app-password fallback flow and UI with secure storage guidance (optional)
- [ ] Add CI checks to avoid committing client secrets; provide `.env.example` and docs
