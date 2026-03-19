---
# skeeditor-mjc5
title: Implement putRecord with swapRecord concurrency control and conflict handling
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:27:01Z
updated_at: 2026-03-18T15:10:01Z
parent: skeeditor-v67t
branch: feat/mjc5-putrecord-conflict-handling
blocked_by:
    - skeeditor-67ad
---

Implement putRecord including the swapRecord optimistic concurrency parameter plus conflict detection and retry-oriented error handling for the edit flow.

Note: Provide a high-level helper for the UI flow that returns conflict-specific results so the modal can show fetch-latest / retry options.

## Todo

- [x] Implement `putRecordWithSwap({repo, collection, rkey, swapRecord, record})` that returns `{ success: boolean, cid?, conflict?: { currentCid, currentValue } , error? }`
- [x] Map AT Protocol error types to structured errors (conflict, validation, network, auth)
- [x] Implement conflict handling helpers to fetch latest record and compute a three-way merge advisory (if possible)
- [x] Add Vitest integration tests simulating swapRecord conflicts (MSW) and verify UI-facing error shapes
- [x] Document retry and user-notification recommendations for the UI Web Component (modal) in `docs/` and the bean body
- [x] Ensure read-after-write semantics are documented and used where applicable

## Summary of Changes

- Added `putRecordWithSwap()` to `XrpcClient` so edit flows receive structured success, conflict, validation, auth, and network results instead of raw exceptions.
- Added `buildThreeWayMergeAdvisory()` to classify client-only, server-only, shared, and conflicting field changes for retry UX.
- Added unit and integration coverage for optimistic concurrency conflict handling and structured error mapping.
- Documented read-after-write semantics plus UI retry / notification guidance in `src/shared/api/README.md` and `docs/putrecord-conflict-handling.md`.
