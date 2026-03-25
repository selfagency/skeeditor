---
# skeeditor-rsp2
title: Message payload validation type guards
status: completed
type: task
priority: high
created_at: 2026-03-25T00:02:38Z
updated_at: 2026-03-25T00:05:05Z
parent: skeeditor-618f
---

Add runtime type guards that validate each request message's required payload fields before routing.

## Todo

- [x] Write failing tests for malformed payloads (missing fields, wrong types)
- [x] Add payload validator functions for GET_RECORD and PUT_RECORD in message-router.ts
- [x] Update router switch cases to use validators and return structured errors
- [x] Verify no regressions — all existing unit tests still pass (20/20 pass)

## Summary of Changes

Added `isNonEmptyString`, `isValidGetRecordPayload`, and `isValidPutRecordPayload` guards to `src/background/message-router.ts`. The router now validates required string fields (`repo`, `collection`, `rkey`) and the `record` object (must be a non-null plain object with a non-empty `$type` string) before any XRPC or auth logic. 7 new unit tests cover all invalid payload shapes; all 20 router unit tests pass, `pnpm typecheck` clean.
