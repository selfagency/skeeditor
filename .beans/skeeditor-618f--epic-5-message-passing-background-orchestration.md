---
# skeeditor-618f
title: 'Epic 5: Message Passing & Background Orchestration'
status: completed
type: epic
priority: critical
created_at: 2026-03-18T14:25:36Z
updated_at: 2026-03-25T01:49:26Z
parent: skeeditor-bmr4
---

Typed message protocol, service worker message router, and routing for getRecord/putRecord/auth queries.

## Todo

- [x] Define a typed message protocol (request/response shapes) for content ↔ background ↔ popup
- [x] Implement message validation and authorization checks in the router
- [x] Provide clear docs/examples for Web Components to emit events / call message APIs
- [x] Add Vitest tests for message routing (mock background and content messaging) and integration tests with MSW
- [x] Ensure all message paths map to XRPC client functions and auth checks

## Summary of Changes

### Child issues completed

- **skeeditor-rsp2** — Message payload validation type guards: Added `isNonEmptyString`, `isValidGetRecordPayload`, `isValidPutRecordPayload` to `message-router.ts`. Router now validates all required payload fields before any auth/XRPC logic. 10 new unit tests added.

- **skeeditor-i979** — Message protocol docs update: Rewrote `docs/messages.md` with correct discriminated `PUT_RECORD_*` response catalogue, a full `switch (result.type)` Web Component example covering all three response variants, a Payload Validation section, and an updated "Adding a new message type" guide.

- **skeeditor-w9kz** — Integration tests with MSW: Created `test/integration/api/message-router-flow.test.ts` (8 tests) using real `XrpcClient` + MSW HTTP mocks. Also discovered and fixed a router bug where non-conflict `putRecordWithSwap` failures (kind=network/auth/validation) were returned as `PUT_RECORD_CONFLICT` instead of `PUT_RECORD_ERROR`.

### Summary stats

- 253 unit + integration tests passing (0 failures)
- `pnpm typecheck` clean
- Router coverage: 84.1% (above the 80% threshold; only browser-API wiring functions are uncovered)
- Branch: `feat/618f-message-passing` — commit `7ec954a`
