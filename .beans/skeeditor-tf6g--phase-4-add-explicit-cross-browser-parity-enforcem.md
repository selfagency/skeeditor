---
# skeeditor-tf6g
title: 'Phase 4: Add explicit cross-browser parity enforcement'
status: completed
type: task
priority: high
created_at: 2026-04-16T02:28:28Z
updated_at: 2026-04-16T04:10:00Z
parent: skeeditor-i0qu
blocked_by:
    - skeeditor-hq59
    - skeeditor-wjvp
---

## Outcome
Prevent browser coverage drift by enforcing a parity manifest and CI checks.

## Todo
- [x] Create journey parity manifest (journey ID -> Chrome test + Firefox test).
- [x] Add automated check that fails on missing parity rows.
- [x] Add waiver mechanism for intentionally blocked scenarios.
- [x] Integrate parity check into required CI gates.
- [x] Document parity policy for contributors.

## Summary of Changes

- Added `test/e2e/journey-parity.json` mapping all 19 journey IDs to Chrome test refs, with Firefox waivers (expires 2026-06-30) for journeys currently constrained by web-ext tooling.
- Added `scripts/check-parity.mjs` validator: fails on missing Chrome coverage, expired Firefox waivers, and missing Firefox coverage without a waiver; warns 14 days before waiver expiry.
- Added `task test:parity` to Taskfile.yml.
- All 19 journeys pass parity check.
