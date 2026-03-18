---
# skeeditor-67ad
title: Implement XRPC client wrapper (getRecord, putRecord)
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:26:56Z
updated_at: 2026-03-18T14:48:16Z
parent: skeeditor-v67t
---

Create a fetch-based XRPC client wrapper or use `@atproto/lex` Client for getRecord and putRecord operations with typed helpers.

Note: Expose a small, testable wrapper that the message router and background service worker will call. Provide documented examples for how UI Web Components should call into the background via message router to reach this API.

## Todo

- [ ] Choose integration strategy: use `@atproto/lex` Client vs light fetch wrapper (recommend: `@atproto/lex` for lexicon validation)
- [ ] Implement `getRecord(repo, collection, rkey) -> { value, cid }` with error mapping
- [ ] Implement `putRecord({ repo, collection, rkey, swapRecord, record })` wrapper that returns structured success/error
- [ ] Add retry/backoff helper utilities for transient network errors
- [ ] Add Vitest unit tests and MSW-based integration tests for XRPC endpoints
- [ ] Document the client API and include example call flows for the content-script → background → client path
