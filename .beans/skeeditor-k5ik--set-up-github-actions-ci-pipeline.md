---
# skeeditor-k5ik
title: Set up GitHub Actions CI pipeline
status: in-progress
type: task
priority: high
created_at: 2026-03-18T14:26:19Z
updated_at: 2026-03-18T17:11:51Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Create CI workflow to run `oxlint`, `oxfmt --check`, type-check, unit tests, integration tests, browser builds, and E2E on merge.

## Todo

- [ ] Review the current build, test, and E2E commands that CI must orchestrate
- [ ] Add a GitHub Actions workflow for lint, format check, typecheck, unit tests, integration tests, build, and E2E
- [ ] Ensure CI installs browser tooling required for Playwright Chromium runs
- [ ] Validate the workflow structure locally as far as practical
