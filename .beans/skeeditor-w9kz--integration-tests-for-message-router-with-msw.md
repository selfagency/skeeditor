---
# skeeditor-w9kz
title: Integration tests for message router with MSW
status: completed
type: task
priority: high
created_at: 2026-03-25T00:03:04Z
updated_at: 2026-03-25T00:09:16Z
parent: skeeditor-618f
---

Integration tests exercising the full message → router → XrpcClient → HTTP path using MSW.

## Todo

- [x] Write failing integration test: router GET_RECORD → real XrpcClient → MSW mock HTTP
- [x] Write failing integration test: router PUT_RECORD success → MSW mock HTTP
- [x] Write failing integration test: router PUT_RECORD conflict → MSW returns 409
- [x] Write failing integration test: router PUT_RECORD conflict - getRecord also fails
- [x] Write failing integration test: router unauthenticated returns structured error
- [x] Fix router: non-conflict swap failures (kind=network/auth/validation) now return PUT_RECORD_ERROR
- [x] Make all integration tests pass (8/8)
- [x] Add unit test coverage for non-conflict swap failure path (22/22 unit tests pass)

## Summary of Changes

Created `test/integration/api/message-router-flow.test.ts` (8 tests) using real `XrpcClient` + MSW mocked XRPC HTTP endpoints. Tests cover GET_RECORD success/404/unauthenticated and PUT_RECORD success/409-with-details/409-no-details-when-getRecord-fails/500-error/unauthenticated.

Also fixed a router bug discovered via the integration tests: `putRecordWithSwap` results with `kind !== 'conflict'` (network/auth/validation errors) now return `PUT_RECORD_ERROR` instead of `PUT_RECORD_CONFLICT`. Added 2 new unit tests for this path.
