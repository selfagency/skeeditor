---
# skeeditor-67ad
title: Implement XRPC client wrapper (getRecord, putRecord, validation)
status: in-progress
type: feature
priority: critical
created_at: 2026-03-18T14:26:56Z
updated_at: 2026-03-18T18:45:02Z
parent: skeeditor-v67t
blocked_by:
    - skeeditor-i92m
branch: feature/67ad-xrpc-client-wrapper
---

Create an XRPC client wrapper (preferably using `@atproto/lex`) for getRecord and putRecord operations with typed helpers and record validation.

Note: Expose a small, testable wrapper that the message router and background service worker will call. Provide documented examples for how UI Web Components should call into the background via message router to reach this API.

## Todo

- [x] Choose integration strategy: use `@atproto/lex` Client vs light fetch wrapper (recommend: `@atproto/lex` for lexicon validation)
- [x] Implement `getRecord(repo, collection, rkey) -> { value, cid }` with error mapping
- [x] Implement `putRecord({ repo, collection, rkey, swapRecord, record })` wrapper that returns structured success/error
- [ ] Add retry/backoff helper utilities for transient network errors
- [x] Add Vitest unit tests and MSW-based integration tests for XRPC endpoints
- [x] Add full-record Lexicon validation before `putRecord` (server-side via `validate` option, defaults to `true`)
- [ ] Document the client API and include example call flows for the content-script → background → client path
