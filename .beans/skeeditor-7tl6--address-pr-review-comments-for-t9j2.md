---
# skeeditor-7tl6
title: address PR review comments for t9j2
status: completed
type: fix
priority: high
created_at: 2026-03-26T18:04:01Z
updated_at: 2026-03-26T18:06:06Z
---

Address PR feedback on t9j2: ensure sign-out cleanup removes active edit modal, make content-script storage-change test deterministic with fake timers, and isolate fetch mocking in message-router tests.

## Todo

- [x] Add sign-out cleanup for active edit modal in content script
- [x] Update content-script storage-change test to use fake timers (no wall-clock wait)
- [x] Ensure message-router tests restore mocked fetch between tests
- [x] Run targeted unit tests for modified files
- [x] Commit and push PR updates

## Summary of Changes

- Added sign-out cleanup in `content-script.ts` to close/remove any active injected `EditModal` and clear the modal reference.
- Updated content-script storage change test to use fake timers and timer advancement instead of wall-clock waiting.
- Added explicit mock restoration in `message-router.test.ts` to prevent `fetch` spy leakage between tests.
- Ran targeted tests for modified files and pushed updates to the PR branch.
