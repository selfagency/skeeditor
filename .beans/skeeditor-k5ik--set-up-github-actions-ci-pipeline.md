---
# skeeditor-k5ik
title: Set up GitHub Actions CI pipeline
status: completed
type: task
priority: high
created_at: 2026-03-18T14:26:19Z
updated_at: 2026-03-18T17:14:52Z
parent: skeeditor-5atd
branch: feature/skeeditor-5atd-project-scaffolding-build-pipeline
---

Create CI workflow to run `oxlint`, `oxfmt --check`, type-check, unit tests, integration tests, browser builds, and E2E on merge.

## Todo

- [x] Review the current build, test, and E2E commands that CI must orchestrate
- [x] Add a GitHub Actions workflow for lint, format check, typecheck, unit tests, integration tests, build, and E2E
- [x] Ensure CI installs browser tooling required for Playwright Chromium runs
- [x] Validate the workflow structure locally as far as practical

## Summary of Changes

- Added `.github/workflows/ci.yml` to run formatting, linting, type-checking, unit tests, integration tests, extension builds, and Chromium Playwright smoke tests on pull requests and pushes to `main`.
- Configured the E2E CI job to install Playwright Chromium and reuse the uploaded `dist/` artifact from the build job.
- Updated the browser API mock typings so the current Vitest toolchain type-checks cleanly during local and CI validation.
