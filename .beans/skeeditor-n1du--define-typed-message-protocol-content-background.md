---
# skeeditor-n1du
title: Define typed message protocol (content ↔ background)
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:29:37Z
updated_at: 2026-03-24T22:59:03Z
parent: skeeditor-618f
---

Document and implement the TypeScript types and shape for messages sent between content scripts, popup, and background/service worker.

## Todo

- [x] Define `MessageRequest` and `MessageResponse` TypeScript discriminated unions for all flows (read, put, auth, status)
- [x] Add helper `sendMessage<TReq, TRes>(req): Promise<TRes>` with type safety for consumers (Web Components)
- [x] Add Vitest unit tests for the type helpers and compile-time checks
- [x] Generate example usage docs showing `edit-modal` and `auth-popup` usage

## Summary of Changes

- `src/shared/messages.ts` — typed message protocol module:
  - Request interfaces: `AuthSignInRequest`, `AuthSignOutRequest`, `AuthReauthorizeRequest`, `AuthGetStatusRequest`, `GetRecordRequest`, `PutRecordRequest`
  - Response types: `OkResponse`, `AuthGetStatusResponse` (authenticated/unauthenticated union), `GetRecordResponse`, `PutRecordResponse`
  - `MessageRequest` discriminated union covering all inbound message shapes
  - `ResponseFor<T extends MessageRequest>` conditional type mapping each request variant to its response
  - `sendMessage<T>(request: T): Promise<ResponseFor<T>>` — type-safe wrapper around `browser.runtime.sendMessage`
- `src/popup/auth-popup.ts` — refactored to use `sendMessage` instead of raw `browser.runtime.sendMessage`
- `docs/messages.md` — usage guide with examples for popup, Web Components, and content scripts; full message catalogue table; instructions for adding new message types
- `test/unit/shared/messages.test.ts` — 5 unit tests covering: request forwarding, status response, GET_RECORD payload, PUT_RECORD payload, error propagation
- All 166 tests pass; `tsc --noEmit` clean
