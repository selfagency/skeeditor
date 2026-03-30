---
# skeeditor-t3gn
title: Fix GitHub Actions YAML parse error in Codecov if condition
status: completed
type: bug
priority: high
branch: fix/t3gn-codecov-if-yaml
created_at: 2026-03-30T18:18:53Z
updated_at: 2026-03-30T18:19:57Z
---

## Context
CI workflow fails to parse due to YAML syntax on Codecov `if` lines using leading `!cancelled()`.

## Todo
- [x] Reproduce and confirm failing YAML section in `.github/workflows/ci.yml`
- [x] Fix `if` expressions to valid GitHub Actions/YAML-safe syntax
- [x] Validate workflow YAML locally
- [x] Summarize change and next steps

## Summary of Changes
- Updated both Codecov-related workflow `if` conditions to expression form: `${{ !cancelled() && env.CODECOV_TOKEN != '' }}`.
- This avoids YAML interpreting leading `!` as a tag and restores valid workflow parsing.
- Verified local YAML parsing of `.github/workflows/ci.yml` succeeds.
