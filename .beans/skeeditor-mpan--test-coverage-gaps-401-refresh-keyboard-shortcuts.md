---
# skeeditor-mpan
title: test coverage gaps 401 refresh keyboard shortcuts
status: completed
type: task
priority: normal
created_at: 2026-03-25T17:56:59Z
updated_at: 2026-03-25T23:19:15Z
parent: skeeditor-pjwz
---

Fill test coverage gaps and fix mock fidelity issues found in the codebase audit:

1. **401 → token refresh not tested** — add integration test: XRPC returns 401, router triggers token refresh, retries.
2. **Modal keyboard shortcuts untested** — add unit tests: Escape closes, Cmd/Ctrl+Enter saves.
3. **Character limit enforcement untested** — add unit test: Save disabled when text > 300 chars.
4. **Mention DID resolution failure untested** — add unit test: `buildFacets` omits facet when DID resolution returns undefined.
5. **Storage mock broken** — `test/mocks/browser-apis.ts`: `storage.local.get(key)` returns full store; fix to return only requested key's value.
6. **`onMessage.addListener` not mocked/verified** — add mock for `browser.runtime.onMessage.addListener` and assert it's called during service worker init.

## Todo

- [x] Fix storage mock: `get(key)` should return `{ [key]: store[key] }` not the full store
- [x] Add `onMessage.addListener` to mock; assert it's called in service worker init test
- [x] Add integration test: 401 from XRPC → proper error returned for GET_RECORD and PUT_RECORD
- [x] Add unit test: Escape key closes modal (keyboard event simulation in jsdom)
- [x] Add unit test: Cmd+Enter / Ctrl+Enter triggers save callback
- [x] Add unit test: save button disabled when textarea.length > 300
- [x] Add unit test: `buildFacets` with DID resolver returning undefined → mention facet omitted
- [x] `pnpm test` all pass (275 pass, 7 E2E expected failures)
- [x] `tsc --noEmit` clean
- [x] Commit with `test:` prefix per phase

## Summary of Changes

Added 8 new tests across 5 files:

- **Storage mock fix**: `test/mocks/browser-apis.ts` now uses a persistent backing store. `get(key)` returns `{ [key]: store[key] }`, `set()` persists to store, `remove()` deletes from store.
- **Modal keyboard shortcuts**: 3 unit tests for Escape (closes modal), Cmd+Enter (saves), Ctrl+Enter (saves).
- **Character limit**: 1 unit test verifying save is blocked with error when text > 300 chars.
- **buildFacets DID failure**: 1 unit test for mention omission when DID resolver returns undefined.
- **Service worker init**: 1 unit test verifying `registerMessageRouter` is called on import.
- **401 integration tests**: 2 integration tests (GET_RECORD + PUT_RECORD) verifying proper error responses when PDS returns 401.

branch: test/mpan-coverage-gaps
