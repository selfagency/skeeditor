---
# skeeditor-dsxj
title: Configure Playwright for extension E2E (Chrome + Firefox)
status: in-progress
type: task
priority: high
created_at: 2026-03-18T14:26:14Z
updated_at: 2026-03-18T17:03:24Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Add Playwright config and fixtures to load extension in Chrome/Firefox for E2E tests.

## Todo

- [ ] Review the current extension build output and determine the minimum smoke-test surface for Chromium and Firefox
- [ ] Add Playwright test dependencies and top-level scripts
- [ ] Create Playwright config with Chromium and Firefox extension projects
- [ ] Add shared E2E fixtures and a static mock Bluesky page
- [ ] Add smoke E2E specs for Chromium and Firefox extension loading
- [ ] Validate the Playwright scaffold with a config/list run or real test execution where supported
