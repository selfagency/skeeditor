---
# skeeditor-tyn3
title: 'Phase 7: Documentation updates for cross-browser E2E workflows'
status: completed
type: task
priority: normal
created_at: 2026-04-16T02:28:28Z
updated_at: 2026-04-16T04:50:00Z
parent: skeeditor-i0qu
blocked_by:
    - skeeditor-69jj
---

## Outcome
Align developer and user-facing docs with the new E2E architecture and workflows.

## Todo
- [x] Update testing docs with exact Chrome and Firefox execution paths.
- [x] Document journey matrix ownership and parity requirements.
- [x] Document bug triage and remediation workflow.
- [x] Add guidance for adding new journey tests.
- [x] Add known limitations and non-goals (including Safari automation scope).

## Summary of Changes

- Added "Adding a new E2E journey test" section to `docs/dev/testing.md` with step-by-step instructions including parity manifest update, waiver format, and commit convention.
- Added "Known limitations and non-goals" section covering Firefox full-journey automation blockers, Safari automation as deliberate non-goal, and devnet E2E scope.
- All cross-references between `testing.md`, `e2e-harness.md`, `e2e-journey-matrix.md`, and `e2e-bug-remediation.md` are now complete.
