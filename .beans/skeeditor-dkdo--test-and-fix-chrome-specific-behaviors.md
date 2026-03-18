---
# skeeditor-dkdo
title: Test and fix Chrome-specific behaviors
status: todo
type: task
priority: high
created_at: 2026-03-18T14:30:16Z
updated_at: 2026-03-18T14:51:38Z
parent: skeeditor-7d7e
---

Run manual and automated tests against Chrome, fix extension/service-worker/content-script behaviors specific to Chrome MV3.

## Todo

- [ ] Verify service worker registration and lifecycle for MV3 (wake-up, event handling)
- [ ] Validate content script injection timing on bsky.app (mutation observer vs load event)
- [ ] Check host permissions and CSP issues when calling XRPC endpoints
- [ ] Run Playwright Chrome tests to reproduce and fix issues
- [ ] Document Chrome-specific workarounds in `docs/platform.md`
