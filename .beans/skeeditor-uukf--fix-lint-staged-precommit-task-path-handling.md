---
# skeeditor-uukf
title: Fix lint-staged precommit task path handling
status: in-progress
type: bug
priority: high
created_at: 2026-03-30T14:12:53Z
updated_at: 2026-03-30T14:12:53Z
parent: skeeditor-d3m1
branch: fix/uukf-lint-staged-precommit
---

The current `lint-staged` integration shells out to `task precommit -- <absolute paths>`, but the Taskfile logic mishandles those arguments and causes the Husky pre-commit hook to fail with `Expected at least one target file`. Fix the pre-commit path handling so staged-file formatting/linting works reliably.

## Todo
- [ ] Reproduce the pre-commit failure with a focused test or command path
- [ ] Fix lint-staged / Taskfile argument handling for staged files
- [ ] Verify pre-commit succeeds for bean markdown and code files
- [ ] Add regression coverage or documented validation steps
- [ ] Commit and push the implementation branch
