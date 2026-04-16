---
# skeeditor-i0qu
title: 'Comprehensive cross-browser E2E program: Chrome + Firefox with remediation workflow'
status: completed
type: milestone
priority: high
created_at: 2026-04-16T02:28:07Z
updated_at: 2026-04-16T04:55:00Z
---

## Goal
Deliver comprehensive end-to-end test coverage for all Skeeditor user journeys in both Chrome and Firefox, with a repeatable bug-remediation workflow and CI enforcement.

## Definition of Done
- All defined user journeys have automated E2E coverage in Chrome and Firefox.
- Firefox execution uses web-ext as the primary E2E path (per project decision).
- CI fails on browser parity gaps and critical journey failures.
- Failure diagnostics (trace/screenshots/logs) are available for triage.
- Testing docs are updated to reflect commands, workflows, and triage policy.

## Constraints
- Preserve existing fixture patterns where practical.
- Prefer user-visible assertions over implementation-coupled checks.
- Keep Safari automation out of this milestone (documentation-only).

## Todo
- [x] Create child beans for each implementation phase.
- [x] Execute each child bean with TDD-style failure-first where applicable.
- [x] Validate Chrome/Firefox parity and CI gates.
- [x] Publish implementation summary and close milestone.


branch: feature/skeeditor-i0qu-cross-browser-e2e-program
