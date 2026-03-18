---
# skeeditor-vwhj
title: 'E2E: extension loads and injects content script on bsky.app'
status: todo
type: test
priority: high
created_at: 2026-03-18T14:30:40Z
updated_at: 2026-03-18T14:53:55Z
parent: skeeditor-965j
---

Playwright E2E test: extension loads, content script is injected, and initial DOM modifications are applied.

## Todo

- [ ] Add Playwright fixture that loads `mock-bsky-page.html` and the built extension unpacked
- [ ] Assert content script injected and `edit-modal` custom element is registered when an owned post is present
- [ ] Capture console logs and extension background messages for debugging
- [ ] Take failure screenshot and save artifacts in CI
