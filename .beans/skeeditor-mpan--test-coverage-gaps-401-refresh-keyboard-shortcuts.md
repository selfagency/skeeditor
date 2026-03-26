---
# skeeditor-mpan
title: test coverage gaps 401 refresh keyboard shortcuts
status: todo
type: task
priority: normal
created_at: 2026-03-25T17:56:59Z
updated_at: 2026-03-25T22:22:54Z
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

- [ ] Fix storage mock: `get(key)` should return `{ [key]: store[key] }` not the full store
- [ ] Add `onMessage.addListener` to mock; assert it's called in service worker init test
- [ ] Add integration test: 401 from XRPC → refresh triggered → original request retried
- [ ] Add unit test: Escape key closes modal (keyboard event simulation in jsdom)
- [ ] Add unit test: Cmd+Enter / Ctrl+Enter triggers save callback
- [ ] Add unit test: save button disabled when textarea.length > 300
- [ ] Add unit test: `buildFacets` with DID resolver returning undefined → mention facet omitted
- [ ] `pnpm test` all pass
- [ ] `tsc --noEmit` clean
- [ ] Commit with `test:` prefix per phase
