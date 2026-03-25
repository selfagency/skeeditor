---
# skeeditor-vwhj
title: 'E2E: extension loads and injects content script on bsky.app'
status: completed
type: test
priority: high
created_at: 2026-03-18T14:30:40Z
updated_at: 2026-03-25T13:31:35Z
parent: skeeditor-965j
blocked_by:
    - skeeditor-dsxj
    - skeeditor-03tp
---

\nPlaywright E2E test: extension loads, content script is injected, and initial DOM modifications are applied.\n\n## Todo\n\n- [x] Add Playwright fixture that loads `mock-bsky-page.html` and the built extension unpacked\n- [x] Assert content script injected and `edit-modal` custom element is registered when an owned post is present\n- [x] Capture console logs and extension background messages for debugging\n- [x] Take failure screenshot and save artifacts in CI\n\n## Summary of Changes\n\n- Added `test/e2e/fixtures/bsky-route-extension.ts`: extended Chromium fixture with `setAuthState`, `routeBskyApp`, `routeXrpcGetRecord`, `routeXrpcPutRecord`, `routeXrpcPutRecordConflict`.\n- Updated `test/e2e/fixtures/mock-bsky-page.html` with two posts (own post with TEST_DID, other user's post with OTHER_DID) and `data-at-uri` attributes.\n- Added test in `test/e2e/chrome.spec.ts`: navigates to intercepted `https://bsky.app`, waits for `data-skeeditor-processed` attribute on own post and console "content script loaded" message.
