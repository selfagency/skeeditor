---
# skeeditor-t3gn
title: Fix GitHub Actions YAML parse error in Codecov if condition
status: in-progress
type: bug
priority: high
branch: fix/t3gn-codecov-if-yaml
created_at: 2026-03-30T18:18:53Z
updated_at: 2026-03-30T18:18:53Z
---

## Context
CI workflow fails to parse due to YAML syntax on Codecov `if` lines using leading `!cancelled()`.

## Todo
- [ ] Reproduce and confirm failing YAML section in `.github/workflows/ci.yml`
- [ ] Fix `if` expressions to valid GitHub Actions/YAML-safe syntax
- [ ] Validate workflow YAML locally
- [ ] Summarize change and next steps
