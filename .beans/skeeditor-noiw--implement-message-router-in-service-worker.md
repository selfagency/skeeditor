---
# skeeditor-noiw
title: Implement message router in service worker
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:29:41Z
updated_at: 2026-03-24T22:59:03Z
parent: skeeditor-618f
blocked_by:
    - skeeditor-n1du
---

Central message router to validate, authorize, and dispatch incoming messages to XRPC/client modules and return typed responses.

## Todo

- [ ] Implement central router in `message-router.ts` with dispatch table
- [ ] Validate incoming messages against `MessageRequest` types and check auth where required
- [ ] Return consistent `MessageResponse` shapes and map client errors to response codes
- [ ] Add Vitest tests that simulate content→background messaging flows (mock chrome.runtime.sendMessage)
- [ ] Integrate with `session-store` to validate auth and token scopes



## Summary of Changes

Marked completed: implemented the central message router in `src/background/message-router.ts`.

- Added `handleMessage` with typed dispatch for AUTH_*/GET_RECORD/PUT_RECORD
- Added `registerMessageRouter` to wire the router into the service worker lifecycle
- Added `createDefaultDeps` to wire `session-store`, `XrpcClient`, and auth helpers
- Verified behavior with unit and integration tests on branch `feat/02o8-content-script-ui` (unit: 207, integration: 23)

Files: `src/background/message-router.ts`, `src/background/service-worker.ts` (router registration)
