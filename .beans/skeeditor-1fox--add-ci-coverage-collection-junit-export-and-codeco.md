---
# skeeditor-1fox
title: Add CI coverage collection, JUnit export, and Codecov reporting
status: completed
type: task
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:12:53Z
parent: skeeditor-d3m1
branch: chore/1fox-ci-coverage-codecov
pr: 77
---

CI currently runs tests but does not publish repository coverage or JUnit test results. Add a canonical coverage workflow using `task`, emit `test-report.junit.xml`, upload coverage to Codecov, and upload test results via Codecov's test-results action.

## Todo
- [x] Add or refine a Taskfile target for CI coverage output
- [x] Configure Vitest to emit coverage artifacts and JUnit XML in CI
- [x] Add a coverage job or steps in `.github/workflows/ci.yml`
- [x] Upload coverage with `codecov/codecov-action@v5`
- [x] Upload test results with `codecov/test-results-action@v1`
- [x] Upload raw coverage and JUnit artifacts to GitHub Actions
- [x] Document local and CI coverage workflow

## Summary of Changes
- Added `task test:coverage:ci` in Taskfile.yml with Vitest coverage and JUnit reporter configuration
- Added `coverage` job in `.github/workflows/ci.yml` that runs coverage collection and uploads to Codecov
- Updated `docs/dev/testing.md` with CI coverage workflow and local coverage documentation
- Added `test-report.junit.xml` to `.gitignore` to prevent generated artifacts in commits
- Created `test/unit/utils/coverage-ci-config.test.ts` with regression tests for Taskfile and CI config wiring
- All tests pass; coverage collection produces clean output; CI job successfully uploads to Codecov
