---
# skeeditor-otl5
title: Implement spec-compliant did:web resolution
status: completed
type: bug
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T15:55:52Z
parent: skeeditor-d3m1
branch: copilot/fixotl5-spec-didweb-resolution
---

`did:web` resolution currently assumes all identifiers map to `/.well-known/did.json`, which breaks path-based identifiers. Implement proper `did:web` URL construction and add regression tests.

## Todo
- [x] Add failing tests for root and path-based `did:web` identifiers
- [x] Implement spec-correct URL resolution for `did:web`
- [x] Cover invalid and percent-encoded path cases
- [x] Verify existing DID resolution behavior for `did:plc` remains unchanged

## Summary of Changes

- `src/shared/api/resolve-did.ts`: Extracted `buildDidWebUrl()` (exported for testing) that correctly splits the method-specific identifier on `:`, treats the first segment as the host (with per-segment `decodeURIComponent`), and remaining segments as URL path components. Root identifiers still resolve to `/.well-known/did.json`; path-based identifiers resolve to `/<path>/did.json`. Empty identifiers throw `DidResolutionError`.
- `test/unit/api/resolve-did.test.ts`: 8 unit tests covering root resolution, path resolution, single-path, percent-encoded port, percent-encoded path segments, and empty-identifier validation.
