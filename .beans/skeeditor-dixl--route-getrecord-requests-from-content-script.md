---
# skeeditor-dixl
title: Route getRecord requests from content script
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:29:45Z
updated_at: 2026-03-25T01:50:13Z
parent: skeeditor-618f
blocked_by:
    - skeeditor-noiw
    - skeeditor-67ad
---

Message handling path to execute getRecord via XRPC client and forward results to requesting content script/modal.

## Todo

- [ ] Implement `handleGetRecord` handler that validates input and calls `getRecord`
- [ ] Map and sanitize `value` for safe transfer to content script (avoid large blobs in message)
- [ ] Add Vitest + MSW tests for getRecord path (simulate success and server errors)
- [ ] Add common error responses and documentation for UI consumers
