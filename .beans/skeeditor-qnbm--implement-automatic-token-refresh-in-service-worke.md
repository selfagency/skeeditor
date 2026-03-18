---
# skeeditor-qnbm
title: Implement automatic token refresh in service worker
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:28:46Z
updated_at: 2026-03-18T14:49:47Z
parent: skeeditor-1e94
---

Service worker task to refresh access tokens before expiry, queue background requests while refreshing, and retry on failure.

## Todo

- [ ] Implement refresh scheduler that triggers before `expires_at`
- [ ] Implement request queuing while a refresh is in-flight
- [ ] Handle refresh failures (backoff, reauthenticate flow) and surface to UI via messages
- [ ] Add Vitest integration tests with MSW to simulate token expiry and refresh flows
- [ ] Document expected behavior and failure modes in `docs/auth.md`
