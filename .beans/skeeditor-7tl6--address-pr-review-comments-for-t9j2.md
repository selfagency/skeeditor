---
# skeeditor-7tl6
title: address PR review comments for t9j2
status: in-progress
type: fix
priority: high
created_at: 2026-03-26T18:04:01Z
updated_at: 2026-03-26T18:04:01Z
branch: fix/t9j2-edit-button-lazy-handle-storage-listener
---

Address PR feedback on t9j2: ensure sign-out cleanup removes active edit modal, make content-script storage-change test deterministic with fake timers, and isolate fetch mocking in message-router tests.

## Todo

- [x] Add sign-out cleanup for active edit modal in content script
- [x] Update content-script storage-change test to use fake timers (no wall-clock wait)
- [x] Ensure message-router tests restore mocked fetch between tests
- [x] Run targeted unit tests for modified files
- [ ] Commit and push PR updates
