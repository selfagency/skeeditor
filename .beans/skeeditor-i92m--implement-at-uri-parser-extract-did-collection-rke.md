---
# skeeditor-i92m
title: Implement AT URI parser (extract did, collection, rkey)
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:26:34Z
updated_at: 2026-03-18T18:42:21Z
parent: skeeditor-v67t
branch: feature/i92m-at-uri-parser
pr: 2
---

Create utility to parse at:// URIs and extract did, collection, rkey; support input from DOM elements and AT Protocol URIs.

## Todo

- [x] Implement `parseAtUri(uri: string)` with robust validation and types
- [x] Support parsing from DOM attributes and bsky.app URL patterns
- [x] Add edge-case unit tests (invalid URIs, missing parts) using Vitest
- [x] Export TypeScript types and update `src/shared/api/README.md` with examples
- [x] Add integration test showing content-script usage (Vitest + MSW if needed)

## Summary of Changes

- Implemented `parseAtUri()` — parses `at://` URIs into `{ uri, repo, collection, rkey }`
- Implemented `parseBskyPostUrl()` — converts bsky.app post URLs to AT URI shape
- Implemented `parseAtUriFromElement()` — extracts AT URI from DOM elements via `data-at-uri`, `data-uri`, or `href` attributes
- Added `AtUriParseError` typed error class
- Added `src/shared/api/README.md` with usage examples
- All 5 unit tests + 1 integration test passing (`@vitest-environment jsdom` override used in integration test)
