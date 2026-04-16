---
# skeeditor-tf6g
title: 'Phase 4: Add explicit cross-browser parity enforcement'
status: todo
type: task
priority: high
created_at: 2026-04-16T02:28:28Z
updated_at: 2026-04-16T02:28:45Z
parent: skeeditor-i0qu
blocked_by:
    - skeeditor-hq59
    - skeeditor-wjvp
---

## Outcome
Prevent browser coverage drift by enforcing a parity manifest and CI checks.

## Todo
- [ ] Create journey parity manifest (journey ID -> Chrome test + Firefox test).
- [ ] Add automated check that fails on missing parity rows.
- [ ] Add waiver mechanism for intentionally blocked scenarios.
- [ ] Integrate parity check into required CI gates.
- [ ] Document parity policy for contributors.
