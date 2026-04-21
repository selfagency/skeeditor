---
# skeeditor-c4o9
title: "Fix popup settings link not opening in production build"
status: completed
type: bug
priority: high
created_at: 2026-04-21T12:49:29Z
updated_at: 2026-04-21T12:55:20Z
branch: "bugfix/skeeditor-c4o9-popup-settings-link-prod"
---

## Context
Settings link in popup opens during development but fails in production.

## Todo
- [x] Reproduce production-only failure locally
- [x] Add failing automated test that captures the regression
- [x] Implement minimal fix
- [x] Verify with tests and production build
- [x] Document root cause in Summary of Changes

## Summary of Changes
- Added a regression unit test covering the packaged-build failure path where `runtime.openOptionsPage()` rejects.
- Updated popup settings click handling to try `browser.runtime.openOptionsPage()` first, then fall back to opening `browser.runtime.getURL('options/index.html')` in a new tab.
- Verified with targeted unit tests and a production Chrome build.
