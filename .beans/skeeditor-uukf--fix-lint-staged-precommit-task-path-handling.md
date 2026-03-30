---
# skeeditor-uukf
title: Fix lint-staged precommit task path handling
status: completed
type: bug
priority: high
created_at: 2026-03-30T14:12:53Z
updated_at: 2026-03-30T14:12:53Z
parent: skeeditor-d3m1
branch: fix/uukf-lint-staged-precommit
---

The current `lint-staged` integration shells out to `task precommit -- <absolute paths>`, but the Taskfile logic mishandles those arguments and causes the Husky pre-commit hook to fail with `Expected at least one target file`. Fix the pre-commit path handling so staged-file formatting/linting works reliably.

## Todo
- [x] Reproduce the pre-commit failure with a focused test or command path
- [x] Fix lint-staged / Taskfile argument handling for staged files
- [x] Verify pre-commit succeeds for bean markdown and code files
- [x] Add regression coverage or documented validation steps
- [x] Commit and push the implementation branch

## Summary of Changes
- Simplified `lint-staged.config.mjs` to call `oxfmt --no-error-on-unmatched-pattern` for all staged files and `oxlint` directly for staged JS/TS files, matching Oxc's recommended pre-commit usage.
- Updated `Taskfile.yml` `precommit` task to normalize absolute paths to repository-relative targets before passing them to `oxlint`/`oxfmt`, and added the unmatched-pattern guard for formatting.
- Added `test/unit/utils/lint-staged-config.test.ts` to lock in the new direct-command hook behavior.
- Verified the focused unit test with Vitest and reproduced-then-fixed the absolute-path `task precommit` failure for both bean markdown and code files.
