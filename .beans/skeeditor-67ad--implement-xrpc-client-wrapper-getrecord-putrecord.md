---
# skeeditor-67ad
title: Implement XRPC client wrapper (getRecord, putRecord, validation)
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:26:56Z
updated_at: 2026-03-18T15:10:01Z
parent: skeeditor-v67t
blocked_by:
    - skeeditor-i92m
---

Create an XRPC client wrapper (preferably using `@atproto/lex`) for getRecord and putRecord operations with typed helpers and record validation.

Note: Expose a small, testable wrapper that the message router and background service worker will call. Provide documented examples for how UI Web Components should call into the background via message router to reach this API.

## Todo

- [ ] Choose integration strategy: use `@atproto/lex` Client vs light fetch wrapper (recommend: `@atproto/lex` for lexicon validation)
- [ ] Implement `getRecord(repo, collection, rkey) -> { value, cid }` with error mapping
- [ ] Implement `putRecord({ repo, collection, rkey, swapRecord, record })` wrapper that returns structured success/error
- [ ] Add retry/backoff helper utilities for transient network errors
- [ ] Add Vitest unit tests and MSW-based integration tests for XRPC endpoints
- [ ] Add full-record Lexicon validation before `putRecord`
- [ ] Document the client API and include example call flows for the content-script → background → client path
