---
# skeeditor-98yx
title: 'Phase 0: Baseline and harness hardening for cross-browser E2E'
status: completed
type: task
priority: high
created_at: 2026-04-16T02:28:28Z
updated_at: 2026-04-16T02:37:06Z
parent: skeeditor-i0qu
---

## Outcome
Establish stable, deterministic E2E harness contracts before adding broad new coverage.

## Todo
- [x] Inventory current E2E specs and map each to user journeys.
- [x] Normalize readiness helpers for content-script and modal states.
- [x] Harden fixture setup for deterministic account/session state.
- [x] Remove implicit timing assumptions and replace with state-based waits.
- [x] Document harness contracts for contributors.

## Summary of Changes
- Added deterministic extension storage fixture helper (`test/e2e/fixtures/extension-storage.ts`) to seed sessions, active account, and settings in one operation.
- Refactored Chromium E2E save-strategy/conflict tests to reuse shared settings setup helper and eliminate repeated ad hoc popup-storage setup.
- Added `docs/dev/e2e-harness.md` documenting readiness contracts, baseline journey inventory, and anti-flake fixture rules.
- Linked harness documentation from `docs/dev/testing.md`.
- Verified with formatting, lint, typecheck, and Chromium E2E suite pass.
