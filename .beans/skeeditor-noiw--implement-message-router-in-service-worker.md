---
# skeeditor-noiw
title: Implement message router in service worker
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:29:41Z
updated_at: 2026-03-18T15:10:01Z
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
