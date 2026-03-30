---
# skeeditor-mlak
title: Align conflict-handling docs with implemented UX or add modal actions
status: in-progress
type: feature
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T22:54:33Z
parent: skeeditor-d3m1
---

Conflict docs promise Reload / Force save and merge-advisory style actions, while the current modal only shows a message. Bring the implementation and documentation back into alignment.

## Todo
- [x] Decide whether to implement richer conflict actions or simplify docs
- [ ] Add failing tests for the chosen conflict UX behavior
- [ ] Implement modal actions if keeping the richer flow
- [ ] Update conflict docs and smoke-test checklist accordingly
- [ ] Re-run relevant unit/E2E conflict tests

### Implementation decision
Chosen path: **simplify docs to match current implemented UX** (conflict warning message + explicit reload instruction) instead of adding Force-save/merge actions in this ticket.

Rationale:
- Current runtime and E2E coverage are built around warning-only conflict handling.
- Force-save/merge introduces higher-risk data-loss semantics and broader UI/API changes.
- This ticket scope is alignment; documentation currently over-promises behavior.
