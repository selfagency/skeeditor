---
# skeeditor-dw2n
title: Implement post rkey extraction from DOM/URL
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:29:05Z
updated_at: 2026-03-23T18:40:00Z
parent: skeeditor-02o8
blocked_by:
    - skeeditor-i92m
---

Extract post `rkey` from DOM attributes or URL patterns to identify the record for read/put operations.

## Summary of Changes

- Extended `src/shared/api/at-uri.ts` with Bluesky URL parsing helpers.
- Added robust parsing for `at://` URIs and `bsky.app/profile/.../post/...` URLs.
- Exposed parsed `repo`, `collection`, and `rkey` values for post actions.
