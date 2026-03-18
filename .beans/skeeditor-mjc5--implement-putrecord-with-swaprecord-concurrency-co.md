---
# skeeditor-mjc5
title: Implement putRecord with swapRecord concurrency control
status: todo
type: feature
priority: critical
created_at: 2026-03-18T14:27:01Z
updated_at: 2026-03-18T14:48:21Z
parent: skeeditor-v67t
---

Implement putRecord including swapRecord optimistic concurrency parameter and proper error handling for conflicts.

Note: Provide a high-level helper for the UI flow that returns conflict-specific results so the modal can show fetch-latest / retry options.

## Todo

- [ ] Implement `putRecordWithSwap({repo, collection, rkey, swapRecord, record})` that returns `{ success: boolean, cid?, conflict?: { currentCid, currentValue } , error? }`
- [ ] Map AT Protocol error types to structured errors (conflict, validation, network, auth)
- [ ] Implement conflict handling helpers to fetch latest record and compute a three-way merge advisory (if possible)
- [ ] Add Vitest integration tests simulating swapRecord conflicts (MSW) and verify UI-facing error shapes
- [ ] Document retry and user-notification recommendations for the UI Web Component (modal) in `docs/` and the bean body
- [ ] Ensure read-after-write semantics are documented and used where applicable
