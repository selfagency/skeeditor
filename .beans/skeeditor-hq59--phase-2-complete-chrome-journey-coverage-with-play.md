---
# skeeditor-hq59
title: 'Phase 2: Complete Chrome journey coverage with Playwright'
status: completed
type: feature
priority: high
created_at: 2026-04-16T02:28:28Z
updated_at: 2026-04-16T02:46:06Z
parent: skeeditor-i0qu
blocked_by:
    - skeeditor-f35j
---

## Outcome
Implement full Chrome journey coverage using existing Playwright fixture architecture.

## Todo
- [x] Expand chrome local suite to cover all matrix journeys.
- [x] Expand chrome devnet suite for real-network save/conflict paths.
- [x] Add missing assertions for auth/account/settings/labeler interactions.
- [x] Ensure conflict and save-strategy paths are fully validated.
- [x] Eliminate flaky waits using readiness helpers and deterministic setup.

## Summary of Changes
- Expanded `test/e2e/chrome.spec.ts` from 9 to 16 Chromium extension tests.
- Added popup/auth journeys: OAuth handoff, reauthorize handoff, account switch, account sign-out, labeler prompt dismiss, and settings-page launch.
- Added content journey for edit-time-limit enforcement on older records.
- Extended fixture utilities in `test/e2e/fixtures/extension-storage.ts` for deterministic multi-account/session/prompt seeding.
- Extended `makeMockGetRecordResult` to support explicit `createdAt` values for time-limit testing.
- Verified with format/lint/typecheck and full Chromium extension E2E pass (16/16).
