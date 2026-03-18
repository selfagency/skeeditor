---
# skeeditor-dsxj
title: Configure Playwright for extension E2E (Chrome + Firefox)
status: completed
type: task
priority: high
created_at: 2026-03-18T14:26:14Z
updated_at: 2026-03-18T17:10:31Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Add Playwright config and fixtures to load extension in Chrome/Firefox for E2E tests.

## Todo

- [x] Review the current extension build output and determine the minimum smoke-test surface for Chromium and Firefox
- [x] Add Playwright test dependencies and top-level scripts
- [x] Create Playwright config with Chromium and Firefox extension projects
- [x] Add shared E2E fixtures and a static mock Bluesky page
- [x] Add smoke E2E specs for Chromium and Firefox extension loading
- [x] Validate the Playwright scaffold with a config/list run or real test execution where supported

## Summary of Changes

- Added Playwright configuration, root E2E scripts, and browser-project scaffolding for Chromium and Firefox.
- Added shared E2E fixtures, including a Chromium extension loader and a static mock Bluesky page for future content-script coverage.
- Updated the build pipeline to emit a merged Chrome `dist/manifest.json`, which allows the Chromium extension smoke test to load the built extension successfully.
