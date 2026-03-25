---
# skeeditor-r8bf
title: Route putRecord requests from content script
status: completed
type: feature
priority: critical
created_at: 2026-03-18T14:29:50Z
updated_at: 2026-03-25T01:50:18Z
parent: skeeditor-618f
blocked_by:
    - skeeditor-noiw
    - skeeditor-67ad
---

Message handling path to execute putRecord with swapRecord, handle conflicts, and return structured success/error states.

## Todo

- [ ] Implement `handlePutRecord` that calls `putRecordWithSwap` helper
- [ ] Ensure conflict responses include `currentCid` and optionally `currentValue` for UI retry
- [ ] Add Vitest + MSW tests to simulate successful put, validation errors, and swapRecord conflicts
- [ ] Document UI recommendations for conflict resolution and user messaging
