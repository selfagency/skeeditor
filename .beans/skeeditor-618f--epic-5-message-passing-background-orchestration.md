---
# skeeditor-618f
title: 'Epic 5: Message Passing & Background Orchestration'
status: todo
type: epic
priority: critical
created_at: 2026-03-18T14:25:36Z
updated_at: 2026-03-18T14:49:55Z
parent: skeeditor-bmr4
---

Typed message protocol, service worker message router, and routing for getRecord/putRecord/auth queries.

## Todo

- [ ] Define a typed message protocol (request/response shapes) for content ↔ background ↔ popup
- [ ] Implement message validation and authorization checks in the router
- [ ] Provide clear docs/examples for Web Components to emit events / call message APIs
- [ ] Add Vitest tests for message routing (mock background and content messaging) and integration tests with MSW
- [ ] Ensure all message paths map to XRPC client functions and auth checks
