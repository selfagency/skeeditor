---
# skeeditor-y2no
title: Fix CREATE_RECORD routing and begin web-components refactor
status: completed
type: bug
priority: high
created_at: 2026-03-29T04:45:43Z
updated_at: 2026-03-29T19:09:11Z
---

## Context
Start implementation from unified plan with risk-first ordering.

## Todo
- [x] Add failing tests for CREATE_RECORD routing behavior (RED)
- [x] Implement KNOWN_TYPES fix for CREATE_RECORD (GREEN)
- [x] Refactor duplicated requiresReauth branch in content-script save path (verified already absent)
- [x] Run targeted tests and fix regressions
- [x] Update docs/plans with unified implementation plan file
- [x] Fix popup sign-out selector mismatch (`account-sign-out` vs `account-remove`)
- [x] Re-run failing popup unit tests
- [x] Run validation (type/lint/tests) and summarize next batch
