---
# skeeditor-ykhp
title: Test and fix Firefox-specific behaviors (web-ext)
status: todo
type: task
priority: high
created_at: 2026-03-18T14:30:21Z
updated_at: 2026-03-18T14:51:45Z
parent: skeeditor-7d7e
---

Use web-ext and Playwright fixtures to exercise Firefox behaviors and compatibility; fix platform differences.

## Todo

- [ ] Test extension using `web-ext run` and Playwright Firefox fixtures
- [ ] Validate background script compatibility (service worker vs background scripts differences)
- [ ] Ensure storage and messaging behave as expected under Firefox (IndexedDB/storage semantics)
- [ ] Document gecko-specific manifest fields (gecko id) and signing guidance
- [ ] Add Playwright/CI job for Firefox smoke tests
