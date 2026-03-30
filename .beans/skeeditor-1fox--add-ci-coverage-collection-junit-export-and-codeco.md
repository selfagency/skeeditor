---
# skeeditor-1fox
title: Add CI coverage collection, JUnit export, and Codecov reporting
status: completed
type: task
priority: high
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T14:58:55Z
parent: skeeditor-d3m1
branch: chore/1fox-ci-coverage-codecov
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
- Added `task test:coverage:ci` to run unit and integration coverage with JUnit output to `test-report.junit.xml`.
- Updated `.github/workflows/ci.yml` with a dedicated coverage job that uploads coverage artifacts and sends coverage plus test results to Codecov when `CODECOV_TOKEN` is available.
- Added `test/unit/utils/coverage-ci-config.test.ts` as a regression test for the Taskfile and CI coverage wiring.
- Updated `docs/dev/testing.md` with local and CI coverage guidance and ignored the generated `test-report.junit.xml` artifact in `.gitignore`.
