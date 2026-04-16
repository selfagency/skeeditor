---
# skeeditor-f35j
title: 'Phase 1: Canonical user-journey matrix and browser parity mapping'
status: completed
type: feature
priority: high
created_at: 2026-04-16T02:28:28Z
updated_at: 2026-04-16T02:40:03Z
parent: skeeditor-i0qu
blocked_by:
    - skeeditor-98yx
---

## Outcome
Define the complete journey coverage matrix and expected assertions for Chrome and Firefox.

## Todo
- [x] Enumerate all user journeys from product and runtime behavior.
- [x] Define expected user-visible assertions per journey.
- [x] Mark browser-specific deltas and constraints.
- [x] Assign a journey ID to each matrix row for traceability.
- [x] Publish parity acceptance criteria used by CI.

## Summary of Changes
- Added canonical journey specification at `docs/dev/e2e-journey-matrix.md` with explicit journey IDs (`J-001`..`J-019`).
- Defined user-visible assertion expectations for each journey and mapped Chrome/Firefox execution paths.
- Captured browser-specific deltas and tooling constraints for this cycle.
- Added parity acceptance criteria used by CI policy phases.
- Linked matrix doc from `docs/dev/testing.md`.
- Verified with formatting, lint, typecheck, and Chromium E2E suite pass.
