---
# skeeditor-ykhp
title: Test and fix Firefox-specific behaviors (web-ext)
status: completed
type: task
priority: high
created_at: 2026-03-18T14:30:21Z
updated_at: 2026-03-25T02:39:53Z
parent: skeeditor-7d7e
blocked_by:
    - skeeditor-ra8t
    - skeeditor-ku9o
    - skeeditor-dsxj
---

Use web-ext and Playwright fixtures to exercise Firefox behaviors and compatibility; fix platform differences.

## Todo

- [ ] Test extension using `web-ext run` and Playwright Firefox fixtures
- [ ] Validate background script compatibility (service worker vs background scripts differences)
- [ ] Ensure storage and messaging behave as expected under Firefox (IndexedDB/storage semantics)
- [ ] Document gecko-specific manifest fields (gecko id) and signing guidance
- [ ] Add Playwright/CI job for Firefox smoke tests
