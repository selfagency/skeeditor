---
# skeeditor-mlak
title: Align conflict-handling docs with implemented UX or add modal actions
status: completed
type: feature
priority: normal
created_at: 2026-03-30T14:04:21Z
updated_at: 2026-03-30T23:02:24Z
parent: skeeditor-d3m1
branch: feat/mlak-align-conflict-handling-docs-ux
pr: 90
---

Conflict docs promise Reload / Force save and merge-advisory style actions, while the current modal only shows a message. Bring the implementation and documentation back into alignment.

## Todo
- [x] Decide whether to implement richer conflict actions or simplify docs
- [x] Add failing tests for the chosen conflict UX behavior
- [x] Implement modal actions if keeping the richer flow (not applicable: chose docs-alignment path)
- [x] Update conflict docs and smoke-test checklist accordingly
- [x] Re-run relevant unit/E2E conflict tests

### Implementation decision
Chosen path: **simplify docs to match current implemented UX** (conflict warning message + explicit reload instruction) instead of adding Force-save/merge actions in this ticket.

Rationale:
- Current runtime and E2E coverage are built around warning-only conflict handling.
- Force-save/merge introduces higher-risk data-loss semantics and broader UI/API changes.
- This ticket scope is alignment; documentation currently over-promises behavior.

### Verification run (this update)
- `test/unit/docs/conflict-docs-alignment.test.ts` (Red then Green)
- `test/unit/content/content-script.test.ts`
- `test/integration/api/message-router-flow.test.ts`
- `test/e2e/chrome.spec.ts` test: `conflict on save shows retry prompt in modal`

## Summary of Changes
- Added `test/unit/docs/conflict-docs-alignment.test.ts` to enforce documentation claims match the shipped conflict UX.
- Updated end-user conflict guidance in `docs/guide/usage.md` and `docs/guide/faq.md` to remove Force-save language.
- Updated developer conflict docs (`docs/dev/conflicts.md`, `docs/putrecord-conflict-handling.md`) to describe current warning-only behavior and frame merge/force-save as optional future enhancement.
- Updated smoke checklist in `docs/dev/testing.md` to validate warning-only reload/retry conflict behavior.
