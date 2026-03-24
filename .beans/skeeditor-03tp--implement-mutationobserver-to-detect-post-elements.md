---
# skeeditor-03tp
title: Implement MutationObserver to detect post elements on bsky.app
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:29:00Z
updated_at: 2026-03-24T22:59:03Z
parent: skeeditor-02o8
---

Content script MutationObserver to find post elements dynamically as the page changes, resilient to DOM tweaks and using stable attributes where possible.

## Summary of Changes

- Implemented `src/content/post-detector.ts` with stable post detection helpers.
- Added scanning for multiple fallback selectors and safe extraction of post identity.
- Integrated post discovery into the content script so new nodes can be detected incrementally.
