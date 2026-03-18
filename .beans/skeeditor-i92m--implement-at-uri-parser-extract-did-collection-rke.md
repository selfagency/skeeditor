---
# skeeditor-i92m
title: Implement AT URI parser (extract did, collection, rkey)
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:26:34Z
updated_at: 2026-03-18T14:45:27Z
parent: skeeditor-v67t
---

Create utility to parse at:// URIs and extract did, collection, rkey; support input from DOM elements and AT Protocol URIs.

## Todo

- [ ] Implement `parseAtUri(uri: string)` with robust validation and types
- [ ] Support parsing from DOM attributes and bsky.app URL patterns
- [ ] Add edge-case unit tests (invalid URIs, missing parts) using Vitest
- [ ] Export TypeScript types and update `src/shared/api/README.md` with examples
- [ ] Add integration test showing content-script usage (Vitest + MSW if needed)
